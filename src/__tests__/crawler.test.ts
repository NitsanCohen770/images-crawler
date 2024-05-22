import mockAxios from 'jest-mock-axios';
import fs from 'fs-extra';
import path from 'path';
import { crawl } from '../crawler';

afterEach(() => {
  // Reset the mock Axios after each test
  mockAxios.reset();
});

const indexPath = path.join(__dirname, '../../images/index.json');

// Mock HTML content
const mockHtmlIndex = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mock Page</title>
</head>
<body>
    <img src="https://example.com/image1.jpg" alt="Image 1">
    <img src="/images/image2.jpg" alt="Image 2">
    <a href="/page2.html">Page 2</a>
</body>
</html>
`;

const mockHtmlPage2 = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mock Page 2</title>
</head>
<body>
    <img src="https://example.com/image3.jpg" alt="Image 3">
    <img src="/images/image3.jpg" alt="Image 4">
</body>
</html>
`;

jest.useFakeTimers();

test('should handle redirects and extract images', async () => {
  console.log('Test started');

  // Ensure the images directory is clean before starting
  await fs.emptyDir(path.join(__dirname, '../../images'));

  // Call the crawl function with the mocked URL
  const crawlPromise = crawl('http://localhost:3000/index.html', 2);

  console.log('Crawl function called');

  // Fast-forward all timers to ensure the axios request is made
  jest.runAllTimers();

  console.log('Timers run, checking axios get calls');

  // Wait for the axios request to be made
  await new Promise(setImmediate); // Let the event loop process the request

  expect(mockAxios.get).toHaveBeenCalledWith(
    'http://localhost:3000/index.html'
  );
  console.log('First axios.get call verified');

  mockAxios.mockResponse({ data: mockHtmlIndex });
  jest.runAllTimers();

  await new Promise(setImmediate); // Let the event loop process the request

  expect(mockAxios.get).toHaveBeenCalledWith(
    'http://localhost:3000/page2.html'
  );
  console.log('Second axios.get call verified');

  mockAxios.mockResponse({ data: mockHtmlPage2 });
  await crawlPromise;

  console.log('Crawl promise resolved');

  // Verify the result in the index.json file
  const index = await fs.readJson(indexPath);

  expect(index).toEqual({
    images: [
      {
        url: 'https://example.com/image1.jpg',
        page: 'http://localhost:3000/index.html',
        depth: 1,
      },
      {
        url: 'http://localhost:3000/images/image2.jpg',
        page: 'http://localhost:3000/index.html',
        depth: 1,
      },
      {
        url: 'https://example.com/image3.jpg',
        page: 'http://localhost:3000/page2.html',
        depth: 2,
      },
      {
        url: 'http://localhost:3000/images/image3.jpg',
        page: 'http://localhost:3000/page2.html',
        depth: 2,
      },
    ],
  });
  console.log('Test completed');
}, 10000); // Increase timeout to 10 seconds
