# To-Do List

Here are the pending tasks for improving the Gemini Live Translator application:

- [ ] Improve overlay accuracy. While bounding box locations from the API are generally correct, perspective distortion or rotated text can still lead to inaccuracies.
- [ ] Add support for SVG image translation. This will require an intermediate step to convert SVG to a raster format (like PNG or JPEG) before processing. A key challenge will be determining the correct boundaries since SVGs don't have a fixed size.
