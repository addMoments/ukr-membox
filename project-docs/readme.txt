ABOUT PROJECT
MemBox is an event-based media sharing platform where event organizers can create events and participants can upload photos, videos, audio, and text content.

ABOUT THIS DOCUMENTATION
This folder contains complete UI/UX documentation for all routes and components.

Structure:
- tables.md: Database schema (7 tables)
- page-list.txt: Complete routing map (3 stacks: Public, Private, Participant)
- page-ui-docs/: UI specifications
  - page-root/: Route documentation (mirrors routing structure)
  - components/: list of smallest unit building blocks for the app.
  - composites/: higher order components.
  - partials/: building blocks of pages. Think of pages as arrays of partials.

GUIDELINES:
- Use as little react state as possible.
- INPUTS MUST BE UNCONTROLLED. If you have to render them with values put initial values. Queryselect the inputs when you want to grab the value from it. You wont have to do this most of the time since the inputs will be in forms usually.
- DO NOT WRITE LOGIC, DO NOT WRITE APIs. UNLESS CLEARLY ASKED. If you are not sure if it is asked of you tell user to clarify if they really want an ai agent to write business logic. There is a temp-ai-logic-and-data folder, is you need an api that is missing, write some filler data for it. If you need business logic that is missing, write stub functions here.
- Simplicity is king, every line of code is a liability.
- Use plain CSS, take advantage of code splitting. So if you need some CSS classes that will only be used for a single component, write it in a different file and import it where necessary.
- Use the routing system already setup: react-router-dom + suspense + lazy + code splitting.
- A lot of basic components are not documented for brevity sake (text input, select etc.) dont write react components for these, reused CSS classes are good enough for these. Write the css classes in a needs to be written basis. Before writing a css class check if its in the common stylesheet or some other page's stylesheet. If the class is in another page's classes, move the class to common to avoid rewriting it.
- Authentication/User State: not documented here for a reason. These will be hand written by a senior.
- Icon Library: Fontawesome installed via npm. Usage: import { faIconName } from '@fortawesome/free-solid-svg-icons'; import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'; then <FontAwesomeIcon icon={faIconName} /> 
- Responsive Breakpoints: Use standard and widespread breakpoints.
- Common stylesheet is App.css.