import { Command } from "commander";
import { crawl } from "./crawler";

const program = new Command();

program
  .version("1.0.0")
  .description("Simple web crawler")
  .argument("<start_url>", "URL to start crawling from")
  .option("-d, --depth <number>", "Depth of crawl", "1")
  .action((start_url, options) => {
    const depth = parseInt(options.depth, 10);
    crawl(start_url, depth);
  });

program.parse(process.argv);
