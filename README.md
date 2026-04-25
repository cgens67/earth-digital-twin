# 🪐 Solar System Digital Twin

A fully interactive, true-scale 3D digital twin of the Solar System built with vanilla JavaScript, Three.js, and Material Design 3. 

Live Demo: [Deployed on Vercel]

## ✨ Features
* **True Scale & Distance**: Uses a Logarithmic Depth Buffer to handle the massive scale differences between planet sizes (e.g., Earth's 6,371 km radius) and interplanetary distances (e.g., Saturn's 1.4 billion km orbit) without z-fighting or rendering glitches.
* **Physics Simulation**: Test out **"What if the Sun disappeared?"**. Toggle the Sun off to watch gravity instantly disable, causing planets to break out of their orbits and drift in tangent linear trajectories into deep space.
* **Seamless Camera Zoom**: Effortlessly focus and zoom from an entire solar system view down to the surface of the Earth.
* **Time Manipulation**: Fast-forward time up to 1 simulated month per second.
* **Mobile-First MD3 UI**: Expressive Material Design 3 interface optimized for touch devices with a dynamic bottom sheet and Floating Action Buttons (FAB).

## 🛠️ Tech Stack
* **Three.js** (Loaded natively via ES Import Maps - no bundler required)
* **HTML5 / CSS3** (Vanilla)
* **Material Symbols & Fonts** (Google Fonts CDN)

## 🚀 Deployment (Vercel)
This project is configured as a purely static site for maximum speed and zero build-time. 

1. Push these files to a GitHub repository.
2. Import the repository into [Vercel](https://vercel.com).
3. Vercel will automatically detect it as a static project.
4. Click **Deploy**. (Zero configuration required).

## 📂 File Structure
* `index.html` - The main entry point, import maps, and MD3 UI structure.
* `style.css` - Material Design 3 responsive styling and themes.
* `main.js` - Three.js rendering logic, orbital mathematics, and UI event listeners.
* `package.json` - Basic project metadata.
