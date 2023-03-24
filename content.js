async function scrapeReviews() {
  console.log("scrapeReviews function has been called.");
  const reviews = [];
  let pagesScraped = 0;
  const maxPagesToScrape = 10;
  let flag1 = 1;  // Always keep these one, because in flipkart, initially, there is only one element with ._1LKTO3 (the next button) but after you press next, there are two elements with ._1LKTO3 (previous & next button).
  let flag2 = 1;  // Also, when we reach the end of pages, there is only one element with ._1LKTO3 (the previous button) and we don't wanna press that, do we? :)
  function waitForReviews() {
    return new Promise((resolve) => {
      const checkForReviews = () => {
        let nextPageButton = null;
        const reviewElements = document.querySelectorAll(".t-ZTKy");
        const currentPageNumberElement = document.querySelector("._2Kfbh8");        
        const totalPagesElement = document.querySelector("._2Kfbh8:last-of-type");
        
        if (flag1 == 1) {
          nextPageButton = document.querySelector("._1LKTO3");
          if (nextPageButton){
            flag1 = 0;
          }          
        } else if (flag1 == 0) {
          nextPageButton = document.querySelectorAll("._1LKTO3")[1];
        }
        if (reviewElements.length > 0 && nextPageButton) {
          resolve();
        } else {
          if (currentPageNumberElement && totalPagesElement) {
            const currentPageNumber = parseInt(currentPageNumberElement.textContent.trim());
            const totalPages = parseInt(totalPagesElement.textContent.trim());
            if (currentPageNumber === totalPages){
              resolve();
            } else {
              setTimeout(checkForReviews, 1000);
            }
          } else {
            setTimeout(checkForReviews, 1000);
          }       
        }
      };
      checkForReviews();
    });
  }

  function waitForDomChange(element, config) {
    return new Promise((resolve) => {
      const observer = new MutationObserver((mutationsList, observer) => {
        for (const mutation of mutationsList) {
          if (mutation.target.classList.contains("_1YokD2")) {
            observer.disconnect();
            resolve();
            break;
          }
        }
      });
      observer.observe(element, config);
    });
  }

  async function scrapePage() {
    console.log("scraping this page");
  
    const reviewElements = document.querySelectorAll(".t-ZTKy");
    for (let reviewElement of reviewElements) {
      let readMoreElement = reviewElement.querySelector("._1H-bmy");
      if (readMoreElement) {
        readMoreElement.remove();
      }
      let reviewText = reviewElement.textContent.trim();
      reviews.push(reviewText);
    }
  
    pagesScraped++;
    console.log("Page " + pagesScraped + " is scraped");
  
    let nextPageButton = document.querySelectorAll("._1LKTO3")[1];
    if (flag2 == 1 && nextPageButton == null) {
      nextPageButton = document.querySelector("._1LKTO3");
      flag2 = 0;
    }
    if (nextPageButton && pagesScraped < maxPagesToScrape) {
      nextPageButton.click();
      console.log("clicked next page button");
      await waitForDomChange(document, { childList: true, subtree: true });
      await waitForReviews();
      await scrapePage();
    }
  }
  

  return new Promise(async (resolve) => {
    const allReviewsLink = document.querySelector("._3UAT2v");
    if (allReviewsLink) {
      allReviewsLink.click();
      console.log("clicked allReviews link");
      await waitForReviews();
      await scrapePage();
    }
    console.log("sending reviews");

    resolve(reviews);
  });
}

async function generateSummary(reviews) {
  const response = await fetch("https://summaryapiserver.onrender.com/summarize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reviews: reviews }),
  });

  if (response.ok) {
    const data = await response.json();
    return data.summary;
  } else {
    throw new Error("GPT's API failed to generate summary");
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "generate_summary") {
    (async () => {
      try {
        const reviews = await scrapeReviews();
        for (let each of reviews) {
          console.log(each);
        }
        const summary = await generateSummary(reviews);
        sendResponse({ summary });
      } catch (error) {
        console.error(error);
        sendResponse({
          summary: "Error! The reviews for this product might be too long for GPT's capacity",
        });
      }
    })();

    return true; // Keeps the message channel open for the async response
  }
});


