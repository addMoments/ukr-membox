UI Documentation Conventions

Folders:
- page-root/    Pages, mirroring the route structure
- partials/     Islands - distinct sections on a page (headers, sidebars, cards, forms)
- components/   Building blocks that get composed into partials (entries, tables, inputs)
- composites/   Multiple components working together as a unit (e.g., FilterBox)
These folders exist under src as well.

Naming:
- Files use camelCase: eventHomeContent.txt, statsCard.txt
- Page files match route: /events/:uid/ → page-root/events/uid/index.txt

File format:
- Brief description of what it is
- Props (if any)
- Layout description (top to bottom, left to right)

