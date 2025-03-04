const cheerio = require('cheerio');
const axios = require('axios');
const URLParse = require('url-parse');
const path = require('path');
const fs = require('fs-extra');
const sanitize = require('sanitize-filename');

class WebsiteScraper {
    constructor(url) {
        this.baseUrl = new URLParse(url);
        this.assets = {
            css: new Set(),
            js: new Set(),
            images: new Set(),
            other: new Set()
        };
        this.outputDir = path.join(process.cwd(), 'downloaded_sites', sanitize(this.baseUrl.hostname));
    }

    async init() {
        try {
            // Create output directories
            await fs.ensureDir(this.outputDir);
            await fs.ensureDir(path.join(this.outputDir, 'css'));
            await fs.ensureDir(path.join(this.outputDir, 'js'));
            await fs.ensureDir(path.join(this.outputDir, 'images'));

            // Fetch and parse the main page
            const response = await axios.get(this.baseUrl.href);
            const $ = cheerio.load(response.data);

            // Find and process all assets
            this.findCSSAssets($);
            this.findJSAssets($);
            this.findImageAssets($);
            this.findOtherAssets($);

            // Download all assets
            await this.downloadAllAssets();

            // Create the index.html file
            await this.createIndexHTML(response.data);

            console.log('Website assets downloaded successfully!');
            console.log(`Output directory: ${this.outputDir}`);
        } catch (error) {
            console.error('Error scraping website:', error.message);
        }
    }

    resolveUrl(url) {
        if (url.startsWith('//')) {
            return `https:${url}`;
        }
        if (url.startsWith('/')) {
            return `${this.baseUrl.origin}${url}`;
        }
        if (!url.startsWith('http')) {
            return `${this.baseUrl.origin}/${url}`;
        }
        return url;
    }

    findCSSAssets($) {
        $('link[rel="stylesheet"]').each((_, element) => {
            const href = $(element).attr('href');
            if (href) {
                this.assets.css.add(this.resolveUrl(href));
            }
        });
    }

    findJSAssets($) {
        $('script[src]').each((_, element) => {
            const src = $(element).attr('src');
            if (src) {
                this.assets.js.add(this.resolveUrl(src));
            }
        });
    }

    findImageAssets($) {
        $('img[src]').each((_, element) => {
            const src = $(element).attr('src');
            if (src) {
                this.assets.images.add(this.resolveUrl(src));
            }
        });
    }

    findOtherAssets($) {
        // Add any other asset types you want to handle here
    }

    async downloadFile(url, type) {
        try {
            const response = await axios({
                url,
                method: 'GET',
                responseType: 'arraybuffer'
            });

            const filename = sanitize(path.basename(new URLParse(url).pathname));
            const filepath = path.join(this.outputDir, type, filename);

            await fs.writeFile(filepath, response.data);
            return { originalUrl: url, localPath: path.join(type, filename) };
        } catch (error) {
            console.error(`Failed to download ${url}:`, error.message);
            return null;
        }
    }

    async downloadAllAssets() {
        const downloadPromises = [];

        for (const cssUrl of this.assets.css) {
            downloadPromises.push(this.downloadFile(cssUrl, 'css'));
        }

        for (const jsUrl of this.assets.js) {
            downloadPromises.push(this.downloadFile(jsUrl, 'js'));
        }

        for (const imageUrl of this.assets.images) {
            downloadPromises.push(this.downloadFile(imageUrl, 'images'));
        }

        const results = await Promise.all(downloadPromises);
        return results.filter(Boolean);
    }

    async createIndexHTML(originalHtml) {
        let $ = cheerio.load(originalHtml);

        // Update CSS links
        $('link[rel="stylesheet"]').each((_, element) => {
            const href = $(element).attr('href');
            if (href) {
                $(element).attr('href', `css/${sanitize(path.basename(href))}`);
            }
        });

        // Update JS links
        $('script[src]').each((_, element) => {
            const src = $(element).attr('src');
            if (src) {
                $(element).attr('src', `js/${sanitize(path.basename(src))}`);
            }
        });

        // Update image sources
        $('img[src]').each((_, element) => {
            const src = $(element).attr('src');
            if (src) {
                $(element).attr('src', `images/${sanitize(path.basename(src))}`);
            }
        });

        // Save the modified HTML
        await fs.writeFile(path.join(this.outputDir, 'index.html'), $.html());
    }
}

// CLI interface
if (require.main === module) {
    const url = process.argv[2];
    if (!url) {
        console.error('Please provide a URL to scrape');
        console.log('Usage: node index.js <url>');
        process.exit(1);
    }

    const scraper = new WebsiteScraper(url);
    scraper.init();
}

module.exports = WebsiteScraper;