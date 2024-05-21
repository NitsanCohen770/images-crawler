import { crawl } from './crawler';

const [, , startUrl, maxDepthArg] = process.argv;

if (!startUrl || !maxDepthArg) {
  console.error('Usage: ts-node src/index.ts <start_url> <depth>');
  process.exit(1);
}

const maxDepth = parseInt(maxDepthArg, 10);

if (isNaN(maxDepth) || maxDepth < 1) {
  console.error('Depth must be a positive integer.');
  process.exit(1);
}

crawl(startUrl, maxDepth)
  .then(() => {
    console.log('Crawling complete.');
  })
  .catch((error) => {
    console.error('Error during crawling:', error);
  });
