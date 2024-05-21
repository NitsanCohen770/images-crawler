import axios from 'axios';
import cheerio from 'cheerio';
import fs from 'fs-extra';
import path from 'path';
import Bottleneck from 'bottleneck';
import debug from 'debug';

const log = debug('crawler');

const config = {
  timeout: 5000,
  userAgent: 'MyCrawler/1.0',
};

const userAgentList = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:55.0) Gecko/20100101 Firefox/55.0',
];

const imagesDir = path.join(__dirname, '..', 'images');
const indexPath = path.join(imagesDir, 'index.json');
const visitedUrls = new Set<string>();

const limiter = new Bottleneck({
  minTime: 200,
  maxConcurrent: 5,
});

interface ImageInfo {
  url: string;
  page: string;
  depth: number;
}

export function getRandomUserAgent(): string {
  return userAgentList[Math.floor(Math.random() * userAgentList.length)];
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (_) {
    return false;
  }
}

export function resolveUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return '';
  }
}

export async function fetchPage(url: string): Promise<string> {
  const userAgent = getRandomUserAgent();
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log(`Fetching page: ${url}`);
      const { data } = await limiter.schedule(() =>
        axios.get(url, {
          timeout: config.timeout,
          headers: { 'User-Agent': userAgent },
        })
      );
      log(`Fetched page: ${url}`);
      return data;
    } catch (error) {
      if (attempt < maxRetries) {
        log(`Retrying fetch for ${url} (attempt ${attempt})`);
      } else {
        if (error instanceof Error) {
          console.error(
            `Failed to fetch page after ${maxRetries} attempts: ${url}`,
            error.message
          );
        } else {
          console.error(
            `Failed to fetch page after ${maxRetries} attempts: ${url}`,
            error
          );
        }
        throw error;
      }
    }
  }
  throw new Error(`Failed to fetch page: ${url}`);
}

export function extractImages(
  html: string,
  url: string,
  depth: number
): ImageInfo[] {
  const $ = cheerio.load(html);
  const images: ImageInfo[] = [];
  $('img').each((_, element) => {
    let src = $(element).attr('src');
    if (src) {
      if (!src.startsWith('http')) {
        src = resolveUrl(url, src);
      }
      images.push({ url: src, page: url, depth });
    }
  });
  log(`Extracted images from ${url} at depth ${depth}:`, images);
  return images;
}

export async function saveImages(images: ImageInfo[]): Promise<void> {
  await fs.ensureDir(imagesDir);
  const index = (await fs
    .readJson(indexPath)
    .catch(() => ({ images: [] }))) as { images: ImageInfo[] };
  index.images.push(...images);
  await fs.writeJson(indexPath, index, { spaces: 2 });
  log('Saved images:', images);
}

function shouldCrawlLink(link: string, baseUrl: string): boolean {
  const baseDomain = new URL(baseUrl).hostname;
  try {
    const linkDomain = new URL(link).hostname;
    return linkDomain === baseDomain;
  } catch {
    return false;
  }
}

export async function crawl(url: string, maxDepth: number): Promise<void> {
  const urlsToCrawl = new Set<string>([url]);
  const newUrls = new Set<string>();

  for (let currentDepth = 1; currentDepth <= maxDepth; currentDepth++) {
    for (const currentUrl of urlsToCrawl) {
      if (visitedUrls.has(currentUrl)) continue;
      visitedUrls.add(currentUrl);
      console.log(`Crawling ${currentUrl} at depth ${currentDepth}`);
      try {
        const html = await fetchPage(currentUrl);
        const images = extractImages(html, currentUrl, currentDepth);
        await saveImages(images);
        if (currentDepth < maxDepth) {
          const $ = cheerio.load(html);
          const links = $('a[href]')
            .map((_, element) => $(element).attr('href'))
            .get()
            .filter((link) =>
              shouldCrawlLink(resolveUrl(currentUrl, link), currentUrl)
            );
          for (const link of links) {
            const resolvedLink = resolveUrl(currentUrl, link);
            newUrls.add(resolvedLink);
            console.log(
              `Queueing link ${resolvedLink} at depth ${currentDepth + 1}`
            );
          }
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error(
            `Error crawling ${currentUrl} at depth ${currentDepth}:`,
            error.message
          );
        } else {
          console.error(
            `Error crawling ${currentUrl} at depth ${currentDepth}:`,
            error
          );
        }
      }
    }
    urlsToCrawl.clear();
    for (const newUrl of newUrls) {
      urlsToCrawl.add(newUrl);
    }
    newUrls.clear();
  }
}

process.on('SIGINT', () => {
  console.log('Gracefully shutting down...');
  process.exit();
});

process.on('SIGTERM', () => {
  console.log('Gracefully shutting down...');
  process.exit();
});
