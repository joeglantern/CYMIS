# Wide opening film

The web version of the opening film for laptops and monitors, made with Remotion. It takes the phone film apart: its three beats play side by side as tall panels, then the C grows into the left 58% of the screen, which is where the desktop sign in shows the same picture.

It lives outside the pnpm workspace on purpose, so the app never installs Remotion.

```
cd tools/splash-film
npm install
npm run setup      # copies the phone film and the sign in still into public/
npm run preview    # opens Remotion Studio
npm run render
ffmpeg -i out/raw.mp4 -an -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -movflags +faststart ../../apps/app/assets/video/splash-wide.mp4
ffmpeg -ss 0 -i ../../apps/app/assets/video/splash-wide.mp4 -frames:v 1 -q:v 5 ../../apps/app/public/splash-first-wide.jpg
```
