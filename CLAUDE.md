# AddMoments (ukr-membox) Project Rules

## ⚠️ Critical Architecture Quirk: index.html & hfSetup.js
Unlike standard React applications, this project manages its header and footer **outside** of the React root element. 

- **The HTML (`public/index.html`)**: The header and footer are hardcoded into the `index.html` file.
- **The Logic (`public/assets/hfSetup.js`)**: A vanilla JavaScript file manages the interactivity, language switching, and dynamic button insertion for the header and footer.

### Rules for modifying the Header/Footer:
1. **Never change class names or IDs blindly**: `hfSetup.js` relies heavily on exact class names (e.g., `.v2-header-mobile-menu`, `#langSel`, `[data-pub="0"]`). If you rename or wrap these elements, the JavaScript `querySelector` will return `null` and crash the entire page.
2. **Synchronize Changes**: If you modify the DOM structure of the header or footer in `index.html`, you **MUST** review and update `hfSetup.js` to ensure that `insertBefore`, `querySelector`, and `innerHTML` calls are targeting the correct, updated DOM nodes.
3. **Translations**: Text is dynamically injected using the `[data-t]` and `[data-t-placeholder]` attributes. Do not remove these attributes unless you are completely removing the element.

## Development & Deployment
- **Build**: Run `npm run build`. Note that a postbuild script (`postbuild.js`) executes automatically.
- **Deploy**: Run `npm run deploy`. This triggers `deploy/deploy.sh` which uploads assets to AWS S3 and the `index.html` file to the FTP server.

## API & Backend Rules
- Whenever creating a new API, you **MUST** also add its documentation in `openapi.yaml` and update the `postman_collection.json` in the root of the project.

## Styling
- The main application uses React components.
- The external header/footer use specific vanilla CSS files (`style-am-v2.css`, `style.css`). Do not use Tailwind for the vanilla CSS files. Ensure desktop and mobile media queries are cleanly separated.
