#!/usr/bin/env node

const WebsiteScraper = require('./index');

const url = process.argv[2];

if (!url) {
    console.error('Please provide a URL to scrape');
    console.log('Usage: frontend-scraper <url>');
    process.exit(1);
}

const scraper = new WebsiteScraper(url);
scraper.init();