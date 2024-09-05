const puppeteer = require('puppeteer');
const fs = require('fs');

async function captureFullVideo(initialUrl, maxWaitTime = 1800000) { // 30 minutes max wait time
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });
    const page = await browser.newPage();
    let videoUrl = null;
    let videoChunks = [];
    let isCapturing = false;

    // Intercept network requests
    await page.setRequestInterception(true);
    page.on('request', request => request.continue());
    page.on('response', async response => {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('video/') || url.includes('.mp4')) {
            if (!isCapturing) {
                console.log('Video stream detected. Starting capture...');
                videoUrl = url;
                isCapturing = true;
            }
            try {
                const chunk = await response.buffer();
                videoChunks.push(chunk);
                console.log(`Captured chunk of size: ${chunk.length} bytes`);
            } catch (error) {
                console.error('Error capturing video chunk:', error);
            }
        }
    });

    try {
        console.log('Navigating to initial page...');
        await page.goto(initialUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        console.log('Please log in manually if required and navigate to the video page.');
        console.log('Start playing the video and let it play until the end.');
        console.log('The script will automatically capture the video as it plays.');
        console.log('Press Enter in the console when the video has finished playing.');

        // Wait for user input or max wait time
        await Promise.race([
            new Promise(resolve => {
                process.stdin.once('data', () => {
                    console.log('Received user input. Stopping the capture...');
                    resolve();
                });
            }),
            new Promise(resolve => setTimeout(resolve, maxWaitTime))
        ]);
    } catch (error) {
        console.error('An error occurred while processing the page:', error);
    } finally {
        await browser.close();
    }

    return { videoUrl, videoChunks };
}

function saveVideoChunks(chunks, outputPath) {
    return new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream(outputPath);
        for (const chunk of chunks) {
            writeStream.write(chunk);
        }
        writeStream.end();
        writeStream.on('finish', () => {
            console.log(`Video saved successfully to ${outputPath}`);
            resolve();
        });
        writeStream.on('error', reject);
    });
}

async function main() {
    const initialUrl = "https://www.linkedin.com/events/...../comments/";
    const outputPath = "linkedin_event_video.mp4";

    try {
        console.log('Starting video capture...');
        const { videoUrl, videoChunks } = await captureFullVideo(initialUrl);
        if (videoChunks.length > 0) {
            console.log('Video content captured. Saving to file...');
            await saveVideoChunks(videoChunks, outputPath);
            console.log(`Total video size: ${videoChunks.reduce((acc, chunk) => acc + chunk.length, 0)} bytes`);
        } else if (videoUrl) {
            console.log('Video URL found, but no content was captured:', videoUrl);
        } else {
            console.log("Failed to capture video content");
        }
    } catch (error) {
        console.error('An error occurred:', error);
    }

    console.log('Script execution completed.');
}

main();
