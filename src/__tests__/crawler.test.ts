import nock from 'nock';
import { crawl } from '../crawler';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

jest.mock('../crawler', () => ({
  ...jest.requireActual('../crawler'),
  downloadImage: jest.fn().mockResolvedValue(undefined),
}));

describe('crawl', () => {
  const imagesDir = path.join(__dirname, '..', '..', 'images');
  const indexPath = path.join(imagesDir, 'index.json');

  beforeEach(async () => {
    await fs.remove(imagesDir);
  });

  it('should handle redirects and extract images', async () => {
    const html = `
      <html>
        <body>
          <img src="https://example.com/image1.jpg" />
          <img src="/image2.jpg" />
          <a href="https://example.com/page2">Next Page</a>
        </body>
      </html>
    `;

    const htmlPage2 = `
      <html>
        <body>
          <img src="https://example.com/image3.jpg" />
        </body>
      </html>
    `;

    nock('https://example.com')
      .get('/')
      .reply(301, '', { Location: 'https://example.com/redirect' })
      .get('/redirect')
      .reply(200, html)
      .get('/page2')
      .reply(200, htmlPage2);

    await crawl('https://example.com', 2);

    const index = await fs.readJson(indexPath);
    console.log('Images in index.json:', index.images);
    expect(index).toEqual({
      images: [
        {
          url: 'https://example.com/image1.jpg',
          page: 'https://example.com/redirect',
          depth: 1,
        },
        {
          url: 'https://example.com/image2.jpg',
          page: 'https://example.com/redirect',
          depth: 1,
        },
        {
          url: 'https://example.com/image3.jpg',
          page: 'https://example.com/page2',
          depth: 2,
        },
      ],
    });

    const { downloadImage } = require('../crawler');

    expect(downloadImage).toHaveBeenCalledWith(
      'https://example.com/image1.jpg',
      path.join(
        imagesDir,
        crypto
          .createHash('sha256')
          .update('https://example.com/image1.jpg')
          .digest('hex') + '.jpg'
      )
    );
    expect(downloadImage).toHaveBeenCalledWith(
      'https://example.com/image2.jpg',
      path.join(
        imagesDir,
        crypto
          .createHash('sha256')
          .update('https://example.com/image2.jpg')
          .digest('hex') + '.jpg'
      )
    );
    expect(downloadImage).toHaveBeenCalledWith(
      'https://example.com/image3.jpg',
      path.join(
        imagesDir,
        crypto
          .createHash('sha256')
          .update('https://example.com/image3.jpg')
          .digest('hex') + '.jpg'
      )
    );
  });
});
