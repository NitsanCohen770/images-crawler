import axios from 'axios';
import cheerio from 'cheerio';
import fs from 'fs-extra';
import path from 'path';
import Bottleneck from 'bottleneck';
import debug from 'debug';
import crypto from 'crypto';
import puppeteer from 'puppeteer';

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

function getRandomUserAgent(): string {
  return userAgentList[Math.floor(Math.random() * userAgentList.length)];
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (_) {
    return false;
  }
}

function resolveUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return '';
  }
}

async function fetchPage(url: string): Promise<string> {
  const userAgent = getRandomUserAgent();
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setUserAgent(userAgent);
  await page.goto(url, { waitUntil: 'networkidle0', timeout: config.timeout });
  const content = await page.content();
  await browser.close();
  return content;
}

function extractImages(html: string, url: string, depth: number): ImageInfo[] {
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
  return images;
}

async function saveImages(images: ImageInfo[]): Promise<void> {
  await fs.ensureDir(imagesDir);
  const index = (await fs
    .readJson(indexPath)
    .catch(() => ({ images: [] }))) as { images: ImageInfo[] };
  index.images.push(...images);
  await fs.writeJson(indexPath, index, { spaces: 2 });
}

async function downloadImage(url: string, filepath: string): Promise<void> {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);
    let error: Error | null = null;
    writer.on('error', (err) => {
      error = err;
      writer.close();
      reject(err);
    });
    writer.on('close', () => {
      if (!error) {
        resolve();
      }
    });
  });
}

function getImageFilename(url: string): string {
  return (
    crypto.createHash('sha256').update(url).digest('hex') + path.extname(url)
  );
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

export async function crawl(
  url: string,
  maxDepth: number,
  currentDepth = 1
): Promise<void> {
  if (!isValidUrl(url)) {
    console.error(`Invalid URL: ${url}`);
    return;
  }
  if (currentDepth > maxDepth || visitedUrls.has(url)) return;
  visitedUrls.add(url);
  console.log(`Crawling ${url} at depth ${currentDepth}`);
  try {
    const html = await fetchPage(url);
    const images = extractImages(html, url, currentDepth);
    await saveImages(images);
    for (const image of images) {
      const filepath = path.join(imagesDir, getImageFilename(image.url));
      await downloadImage(image.url, filepath);
    }
    if (currentDepth < maxDepth) {
      const $ = cheerio.load(html);
      const links = $('a[href]')
        .map((_, element) => $(element).attr('href'))
        .get();
      for (const link of links) {
        const resolvedLink = resolveUrl(url, link);
        if (shouldCrawlLink(resolvedLink, url)) {
          await crawl(resolvedLink, maxDepth, currentDepth + 1);
        }
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        `Error crawling ${url} at depth ${currentDepth}:`,
        error.message
      );
    } else {
      console.error(`Error crawling ${url} at depth ${currentDepth}:`, error);
    }
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
