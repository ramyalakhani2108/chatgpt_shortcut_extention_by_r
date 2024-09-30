
var tid = 0;
document.getElementById('submitBtn').addEventListener('click', () => {
    const userInput = document.getElementById('userInput').value;

    // Open ChatGPT in a new tab
    chrome.tabs.create({ url: 'https://chat.openai.com' }, (tab) => {
        if (chrome.runtime.lastError) {
            console.error('Error creating tab:', chrome.runtime.lastError.message);
            return;
        }
    
        console.log('Tab ID:', tab.id); // Log the created tab ID
        tid = tab.id;
        // Use a delay to ensure the tab is loaded before executing the script
        setTimeout(() => {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (input) => {
                    // Create a loading overlay
                    const loaderDiv = document.createElement('div');
                loaderDiv.style.position = 'fixed';
                loaderDiv.style.top = '0';
                loaderDiv.style.left = '0';
                loaderDiv.style.width = '100%';
                loaderDiv.style.height = '100%';
                loaderDiv.style.backgroundColor = 'rgba(0, 0, 0, 1)'; // Dark background
                loaderDiv.style.zIndex = '9999'; // Ensure it covers everything
                loaderDiv.style.display = 'flex';
                loaderDiv.style.flexDirection = 'column';
                loaderDiv.style.justifyContent = 'center';
                loaderDiv.style.alignItems = 'center';
                loaderDiv.innerHTML = `
                    <div class="loader"></div>
                    <div id="countdown" style="margin-top: 20px; font-size: 24px; color: #ffffff; text-align: center;">Redirecting in <span id="time">Few</span> seconds...</div>
                `;
                document.body.appendChild(loaderDiv); // Append the loader to the body

                loaderDiv.classList.add('fade-in');
                setTimeout(() => {
                    loaderDiv.classList.remove('fade-in');
                    loaderDiv.classList.add('fade-out');
                }, countdown * 1000);  // Remove the loader after the countdown

                // CSS for loader animation (you can customize this)
                const style = document.createElement('style');
                style.innerHTML = `
                    .loader {
                        border: 8px solid #f3f3f3; /* Light grey */
                        border-top: 8px solid #3498db; /* Blue */
                        border-radius: 50%;
                        width: 50px;
                        height: 50px;
                        animation: spin 1s linear infinite;
                    }

                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(style);
    
                    // Find the chat input element using its attributes
                    const chatInput = document.querySelector('p[data-placeholder="Message ChatGPT"].placeholder');
                    if (chatInput) {
                        // Set the inner HTML with the user input
                        chatInput.innerHTML = input;
                        chatInput.dispatchEvent(new Event('input', { bubbles: true })); // Trigger input event
    
                        // Function to check for the send button's visibility and click it
                        const checkAndClickSendButton = () => {
                            const sendButton = document.querySelector('button[aria-label="Send prompt"][data-testid="send-button"]');
                            if (sendButton && !sendButton.disabled) {
                                sendButton.click(); // Click the send button
                                console.log('Send button clicked.');
    
                                // Wait for 15 seconds and check for the copy button
                                setTimeout(checkForCopyButton, 1000); // Wait for the copy button
                            } else {
                                console.log('Send button not ready yet, retrying...');
                                setTimeout(checkAndClickSendButton, 500); // Retry after 500ms
                            }
                        };
    
                        // Function to check for the copy button and click it
                        const checkForCopyButton = () => {
                            const copyButton = document.querySelector('button[aria-label="Copy"][data-testid="copy-turn-action-button"]');
                            if (copyButton) {
                                copyButton.click(); // Click the copy button
                                console.log('Copy button clicked.');
    
                                // Use a delay to ensure the document is focused
                                setTimeout(() => {
                                    // Now try to read from the clipboard
                                    navigator.clipboard.readText()
                                        .then((copiedText) => {
                                            console.log('Copied text:', copiedText);
    
                                            // Send the copied text back to the extension
                                            chrome.runtime.sendMessage({ responseText: copiedText });
    
                                            // Start countdown before closing the tab
                                            startCountdown(tab.id, loaderDiv);
                                        })
                                        .catch((error) => {
                                            console.error('Failed to copy text:', error);
                                            document.body.removeChild(loaderDiv); // Remove the loader on error
                                        });
                                }, 1000); // Adjust this timeout as necessary
                            } else {
                                console.log('Copy button not available yet, retrying...');
                                setTimeout(checkForCopyButton, 500); // Retry after 500ms
                            }
                        };
    
                        // Start checking for the send button's visibility
                        checkAndClickSendButton();
                    } else {
                        console.error('Chat input not found.');
                        document.body.removeChild(loaderDiv); // Remove the loader if chat input not found
                    }
    
                    // Function to handle countdown
                    function startCountdown(tabId, loader) {
                        let countdown = 3; // 3 seconds countdown
                        const countdownElement = document.getElementById('time');
                        const interval = setInterval(() => {
                            countdown--;
                            countdownElement.textContent = countdown;
                            if (countdown <= 0) {
                                clearInterval(interval); // Clear the interval
                                document.body.removeChild(loader); // Remove the loader
                                chrome.tabs.remove(tabId); // Close the tab
                            }
                        }, 1000); // Update every second
                    }
                },
                args: [userInput],
            }).catch(error => {
                console.error('Error executing script:', error);
            });
        }, 2000); // Increase to 10 seconds or more if needed
    });
    
    
});

// Listen for messages from the content script

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.responseText) {
        const responseDiv = $('#responseDiv');

        // Update the displayed text without refreshing the extension page
        if (responseDiv.length) {
            const tempElement = $('<div>').html(message.responseText); // Use .html() to allow HTML tags

            const codeBlocks = tempElement.html().match(/```(\w+)?\n([\s\S]*?)```/g);
            let formattedResponse = '';
            let nonCodeHtml = tempElement.html(); // Store the entire HTML

            if (codeBlocks) {
                codeBlocks.forEach(codeBlock => {
                    const languageMatch = codeBlock.match(/```(\w+)?\n/);
                    const codeContent = codeBlock.replace(/```(\w+)?\n/g, '').replace(/```/g, '').trim(); // Remove backticks and language

                    // Add language name as H1
                    if (languageMatch) {
                        const languageName = languageMatch[1] || 'Code';
                        formattedResponse += `<h1 class="language-name">${languageName}</h1>`;
                    }

                    // Add formatted code block with a copy button
                    formattedResponse += `
                        <div class="code-block">
                            <pre><code>${escapeHtml(codeContent)}</code></pre>
                            <button class="copy-button" data-code="${encodeURIComponent(codeContent)}">Copy Code</button>
                        </div>
                    `;

                    // Remove code blocks from non-code HTML
                    nonCodeHtml = nonCodeHtml.replace(codeBlock, ''); 
                });
            }

            // Format the non-code text for better readability
            nonCodeHtml = formatMarkdown(nonCodeHtml);

            // Render the response with non-code HTML and formatted code blocks
            responseDiv.html(`
                Response from ChatGPT:
                <div class="formatted-text">${nonCodeHtml}</div>
                ${formattedResponse}
            `);

            // Attach jQuery event listener to the copy buttons
            $('.copy-button').on('click', function() {
                const codeToCopy = decodeURIComponent($(this).data('code')); // Get the code from the data attribute
                copyToClipboard(codeToCopy);
            });

            // Send message to close the ChatGPT tab after printing the response
            chrome.tabs.remove(tid, () => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError);
                }
            });
        } else {
            console.error('Element with ID responseDiv not found.');
        }
    }
});


// Function to escape HTML characters for safe display
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Function to copy text to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        console.log('Copied to clipboard: ', text);
    }).catch(err => {
        console.error('Could not copy text: ', err);
    });
}

// Function to format text that is not within code blocks
function formatMarkdown(text) {
    // Example implementation of Markdown formatting (customize as needed)
    // Convert *bold* to <strong>bold</strong>
    text = text.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    
    // Convert _italic_ to <em>italic</em>
    text = text.replace(/_(.*?)_/g, '<em>$1</em>');
    
    // Convert [link text](url) to <a href="url">link text</a>
    text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Add additional formatting styles if desired
    text = text.replace(/\n/g, '<br>'); // Preserve line breaks

    return text; // Return the formatted text
}

document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
});

function closeTabWithAnimation(tabId) {
    let opacity = 1;
    const interval = setInterval(() => {
        opacity -= 0.1;
        document.body.style.opacity = opacity;
        if (opacity <= 0) {
            clearInterval(interval);
            chrome.tabs.remove(tabId); // Close tab after animation
        }
    }, 50);
}


function smoothCloseAnimation(tabId) {
    // Create an overlay that will simulate the tab closing animation
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'; // Dark background
    overlay.style.zIndex = '9999'; // On top of everything
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.transition = 'all 1s ease'; // Smooth transition effect
    
    // Add text or other visuals to the overlay
    overlay.innerHTML = `
        <div style="color: white; font-size: 24px; text-align: center;">
            <p>Closing the tab...</p>
            <p style="font-size: 14px;">Please wait...</p>
        </div>
    `;

    document.body.appendChild(overlay); // Append overlay to the page

    // Start animation after a short delay
    setTimeout(() => {
        // Simulate shrinking effect (or you can do a fade-out)
        overlay.style.transform = 'scale(0.1)';
        overlay.style.opacity = '0';

        // After animation ends (1 second in this case), close the tab
        setTimeout(() => {
            chrome.tabs.remove(tabId, () => {
                console.log('Tab closed smoothly.');
            });
        }, 1000); // Match this delay to the length of the transition
    }, 500); // Initial delay before starting the animation
}

