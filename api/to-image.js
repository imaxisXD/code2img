const { themes } = require("../themes");
import chromium from "@sparticuz/chromium";
const { performance } = require("perf_hooks");
const { languages } = require("../languages");
import puppeteer from "puppeteer-core";

const DEFAULTS = {
  VIEWPORT: {
    WIDTH: 1000,
    HEIGHT: 1000,
    DEVICE_SCALE_FACTOR: 2,
  },
  INDEX_PAGE: "preview.html",
};

const fonts = [
  "Inconsolata.ttf",
  "NotoColorEmoji.ttf",
  "FiraCode-Regular.ttf",
  "FiraCode-Bold.ttf",
  "DejaVuSansMono.ttf",
  "DejaVuSansMono-Bold.ttf",
  "UbuntuMono-Regular.ttf",
  "UbuntuMono-Bold.ttf",
  "RobotoMono-Bold.ttf",
  "RobotoMono-Regular.ttf",
];

function toSeconds(ms) {
  const x = ms / 1000;
  return x.toFixed(2);
}

function sendErrorResponse(response, responseObject) {
  response.status(400);
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.json(responseObject);
}

/**
 * Trim end of lines if it is a multi line string
 * @type {string}
 */
function trimLineEndings(text) {
  let trimmedText = text;
  if (text && typeof text === "string") {
    trimmedText = text
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n");
  }
  return trimmedText;
}

module.exports = async (request, response) => {
  try {
    const hostname =
      process.env.NODE_ENV === "production"
        ? "https://code2img-orcin.vercel.app"
        : "http://localhost:3000";
    const tStart = performance.now();

    console.log("🎉 ", request.url);
    console.log("🛠 ", `Environment: ${process.env.NODE_ENV || "local"}`);
    console.log("🛠 ", `Rendering Method: Puppeteer, Chromium headless`);
    console.log("🛠 ", `Hostname: ${hostname}`);

    let body;
    try {
      console.log(request.body);
      body = request.body;
    } catch (error) {
      console.log("❌ ", "Invalid JSON body");
      sendErrorResponse(response, {
        message:
          "Invalid JSON body. Please provide a valid JSON with 'code' and 'backgroundColor' properties.",
      });
      return;
    }
    const { code, backgroundColor } = body;
    let theme = request.query["theme"];
    let language = request.query["language"];
    let lineNumbers = request.query["line-numbers"];
    let backgroundPadding = request.query["padding"] || "";
    let backgroundImage = request.query["background-image"] || "";
    let showBackground = request.query["show-background"] || "true";

    let width = DEFAULTS.VIEWPORT.WIDTH;
    let scaleFactor = DEFAULTS.VIEWPORT.DEVICE_SCALE_FACTOR;

    if (typeof code != "string") {
      console.log("❌ ", "Code snippet missing");
      sendErrorResponse(response, {
        message: "Code snippet missing, please include it in the request body",
      });
      return;
    }

    if (!language || languages.indexOf(language) === -1) {
      console.log(
        "❌ ",
        !language ? "Language not specified" : `Unknown language '${language}'`
      );
      sendErrorResponse(response, {
        message: !language
          ? "language missing: please specify a language"
          : `Unknown language '${language}'`,
        availableLanguages: languages,
      });
      return;
    }

    if (themes.indexOf(theme) === -1) {
      console.log("❌ ", `Unknown theme '${theme}'`);
      sendErrorResponse(response, {
        message: `Unknown theme: '${theme}'`,
        availableThemes: themes,
      });
      return;
    }

    if (backgroundPadding) {
      try {
        let padding = parseInt(backgroundPadding);
        backgroundPadding = Math.min(Math.max(0, padding), 10); // Make sure number is in range between 1-10
      } catch (error) {
        backgroundPadding = "";
      }
    }

    try {
      scaleFactor =
        parseInt(request.query["scale"]) ||
        DEFAULTS.VIEWPORT.DEVICE_SCALE_FACTOR;
      scaleFactor = Math.min(Math.max(1, scaleFactor), 5); // Make sure number is in range between 1-5
    } catch (e) {
      scaleFactor = DEFAULTS.VIEWPORT.DEVICE_SCALE_FACTOR;
    }

    console.log("🛠 ", `Theme: ${theme}`);
    console.log("🛠 ", `Language: ${language}`);
    console.log("🛠 ", `Line Numbers: ${lineNumbers}`);
    console.log("🛠 ", `Scale Factor: ${scaleFactor}`);
    console.log("🛠 ", `width: ${width}`);
    console.log("🛠 ", `Background Color: ${backgroundColor}`);
    console.log("🛠 ", `Background Image: ${backgroundImage}`);
    console.log("🛠 ", `Show Background: ${showBackground}`);
    console.log("🛠 ", `Background Padding: ${backgroundPadding}`);

    try {
      width = Math.min(Math.abs(parseInt(request.query["width"])), 1920);
    } catch (exception) {
      console.warn("Invalid width", exception);
      width = DEFAULTS.VIEWPORT.WIDTH;
    }

    let trimmedCodeSnippet = trimLineEndings(code);

    let queryParams = new URLSearchParams();
    theme && queryParams.set("theme", theme);
    language && queryParams.set("language", language);
    queryParams.set(
      "line-numbers",
      lineNumbers === "true" ? lineNumbers : "false"
    );
    queryParams.set("code", trimmedCodeSnippet);
    queryParams.set("background-image", backgroundImage);
    if (backgroundColor) {
      queryParams.set("background-color", encodeURIComponent(backgroundColor));
    }
    queryParams.set("show-background", showBackground);
    queryParams.set("padding", backgroundPadding);

    const queryParamsString = queryParams.toString();
    const pageUrl = `${hostname}/preview.html?${queryParamsString}`;

    fonts.forEach(async (font) => {
      const fontUrl = `https://raw.githack.com/cyberpirate92/code2img/master/public/fonts/${font}`;
      console.log("🛠 ", `Loading ${fontUrl}`);
      await chromium.font(fontUrl);
    });
    console.log("🛠 ", "Preview Page URL", pageUrl);

    const browser = await puppeteer.launch({
      // args: ["--no-sandbox", "--disable-setuid-sandbox"], //Comment for prod
      args: chromium.args, //Comment for local
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true, //false for local true for prd
      ignoreHTTPSErrors: true,
      //Comment belwo for prod
      // executablePath:
      //   "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe",
    });

    const page = await browser.newPage();
    await page.goto(pageUrl, {
      waitUntil: "networkidle2",
    });

    // set window header background same as the body
    await page.evaluate(() => {
      const codeContainer = document.getElementById("code-container");
      const windowHeader = document.getElementById("header");
      const container = document.getElementById("container");

      if (codeContainer && windowHeader && container) {
        const containerBackground =
          window.getComputedStyle(container).background;
        const codeBackground =
          window.getComputedStyle(codeContainer).background;

        if (
          containerBackground !== "rgba(0, 0, 0, 0)" &&
          containerBackground !== "transparent"
        ) {
          // Custom background is set
          container.style.background = containerBackground;
          windowHeader.style.background = codeBackground;
        } else {
          // No custom background, use code editor background
          windowHeader.style.background = codeBackground;
        }
      }
    });

    await page.setViewport({
      deviceScaleFactor: scaleFactor,
      width: width || DEFAULTS.VIEWPORT.WIDTH,
      height: DEFAULTS.VIEWPORT.HEIGHT,
      isMobile: false,
    });

    const codeView = await page.$(showBackground ? "#container" : "#window");
    var image = await codeView.screenshot();

    console.log(
      "⏰ ",
      `Operation finished in ${toSeconds(performance.now() - tStart)} seconds`
    );
    response.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": image.length,
      "Access-Control-Allow-Origin": "*",
    });
    response.end(image);
    await page.close();
    await browser.close();
  } catch (e) {
    console.error("Uncaught Exception", e);
    response.status(500).json({ error: "Internal server error" });
  }
};
