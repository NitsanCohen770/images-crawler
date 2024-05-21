# Images Crawler

Images Crawler is a CLI tool to crawl websites and extract images. It saves the images and generates an index file listing all the collected images with their source URLs and depths.

## Features

- Crawl websites to a specified depth
- Extract and save images
- Generate an index.json file listing collected images

## Installation

```sh
pnpm install
```

## Usage

```sh
pnpm ts-node src/index.ts <start_url> <depth>
```

Example:

```sh
pnpm ts-node src/index.ts https://example.com 2
```

## Development

### Linting and Formatting

```sh
pnpm lint
pnpm format
```

### Running Tests

```sh
pnpm test
```

## License

This project is licensed under the MIT License.
