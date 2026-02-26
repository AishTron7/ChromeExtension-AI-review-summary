async function scrapeFlipkartReviews() {
  console.log("scrapeFlipkartReviews called");

  // Build the reviews base URL from the current page
  const currentUrl = new URL(window.location.href);
  let reviewsBaseUrl;

  if (currentUrl.pathname.includes('/product-reviews/')) {
    // Already on reviews page — strip existing page param
    currentUrl.searchParams.delete('page');
    reviewsBaseUrl = currentUrl.toString();
  } else {
    // On product page — transform /p/ → /product-reviews/
    const parts = currentUrl.pathname.split('/');
    const pIdx = parts.indexOf('p');
    if (pIdx === -1) {
      console.log("Could not determine reviews URL from product page");
      return [];
    }
    parts[pIdx] = 'product-reviews';
    const pid = currentUrl.searchParams.get('pid');
    reviewsBaseUrl = currentUrl.origin + parts.join('/') + (pid ? `?pid=${pid}` : '');
  }

  console.log("Reviews base URL:", reviewsBaseUrl);

  // Fetch multiple pages of reviews using fetch + DOMParser (no navigation needed)
  const reviews = [];
  const maxPages = 10;
  const separator = reviewsBaseUrl.includes('?') ? '&' : '?';

  for (let page = 1; page <= maxPages; page++) {
    try {
      const pageUrl = `${reviewsBaseUrl}${separator}page=${page}`;
      console.log(`Fetching page ${page}...`);
      const resp = await fetch(pageUrl);
      const html = await resp.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const reviewElements = doc.querySelectorAll('span.css-1qaijid');
      let pageReviewCount = 0;

      reviewElements.forEach(el => {
        const text = el.textContent.trim();
        if (text.length > 20) {
          reviews.push(text);
          pageReviewCount++;
        }
      });

      console.log(`Page ${page}: ${pageReviewCount} reviews (total: ${reviews.length})`);
      if (pageReviewCount === 0) break; // No more reviews
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
      break;
    }
  }

  console.log("Total Flipkart reviews scraped:", reviews.length);
  return reviews;
}

async function scrapeAmazonReviews() {
  console.log("scrapeAmazonReviews called");

  // Build the reviews base URL from the current page
  const currentUrl = window.location.href;
  let reviewsBaseUrl;

  if (currentUrl.includes("/product-reviews/")) {
    // Already on reviews page — use current URL as base
    const url = new URL(currentUrl);
    url.searchParams.delete('pageNumber');
    reviewsBaseUrl = url.toString();
  } else {
    // On product page — construct reviews URL from /dp/ASIN pattern
    const urlParts = currentUrl.split("/");
    const dpIndex = urlParts.findIndex((part) => part === "dp");
    if (dpIndex === -1 || !urlParts[dpIndex + 1]) {
      console.log("Could not determine ASIN from product page URL");
      return [];
    }
    const productName = urlParts[dpIndex - 1];
    const asin = urlParts[dpIndex + 1].split("?")[0]; // strip query params from ASIN
    const domain = currentUrl.includes("amazon.com") ? "www.amazon.com" : "www.amazon.in";
    reviewsBaseUrl = `https://${domain}/${productName}/product-reviews/${asin}/ref=cm_cr_dp_d_show_all_btm?ie=UTF8&reviewerType=all_reviews`;
  }

  console.log("Amazon reviews base URL:", reviewsBaseUrl);

  // Fetch multiple pages using fetch + DOMParser (no navigation needed)
  const reviews = [];
  const maxPages = 5;

  for (let page = 1; page <= maxPages; page++) {
    try {
      const pageUrl = `${reviewsBaseUrl}&pageNumber=${page}`;
      console.log(`Fetching Amazon page ${page}...`);
      const resp = await fetch(pageUrl);
      const html = await resp.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // Try multiple selectors for robustness
      let reviewElements = doc.querySelectorAll('div[data-hook="review"] span[data-hook="review-body"]');
      if (reviewElements.length === 0) {
        reviewElements = doc.querySelectorAll('[data-hook="review-body"]');
      }

      let pageReviewCount = 0;
      reviewElements.forEach(el => {
        const text = el.textContent.trim();
        if (text) {
          reviews.push(text);
          pageReviewCount++;
        }
      });

      console.log(`Amazon page ${page}: ${pageReviewCount} reviews (total: ${reviews.length})`);
      if (pageReviewCount === 0) break;
    } catch (error) {
      console.error(`Error fetching Amazon page ${page}:`, error);
      break;
    }
  }

  console.log("Total Amazon reviews scraped:", reviews.length);
  return reviews;
}

async function scrapeReviews() {
  const currentUrl = window.location.href;

  if (currentUrl.includes("flipkart.com")) {
    return await scrapeFlipkartReviews();
  } else if (currentUrl.includes("amazon.com") || currentUrl.includes("amazon.in")) {
    return await scrapeAmazonReviews();
  } else {
    console.error("Unsupported website.");
    return [];
  }
}

async function generateSummary(reviews) {
  const response = await fetch("https://summaryapiserver.onrender.com/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviews }),
  });

  if (response.ok) {
    const data = await response.json();
    return data.summary;
  } else {
    throw new Error("GPT's API failed to generate summary, check if the length of reviews is too long");
  }
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.message === "generate_summary") {
    (async () => {
      try {
        const reviews = await scrapeReviews();
        console.log("Total reviews scraped:", reviews.length);
        for (let each of reviews) {
          console.log(each);
        }
        const summary = await generateSummary(reviews);
        sendResponse({ summary });
      } catch (error) {
        console.error(error);
        sendResponse({
          summary: "Error! The reviews for this product might be too long for GPT's current capacity",
        });
      }
    })();

    return true; // Keep message channel open for async response
  }
});

