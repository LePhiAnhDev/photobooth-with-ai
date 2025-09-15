# Photobooth with AI

A modern, AI-powered photobooth web application built with Next.js, TypeScript, and Tailwind CSS.

## Features

- **Camera Integration**: Real-time camera access with countdown timer
- **Photo Capture**: Capture up to 6 photos with automatic progression
- **Photo Selection**: Choose 3 photos from captured images
- **Color Filters**: Apply various color filters (White, Pink, Black, Yellow)
- **Responsive Design**: Optimized for desktop and tablet devices
- **Modern UI**: Clean, futuristic design with blue theme and grid background
- **Performance**: Built with Next.js 15 and optimized for production

## Tech Stack

- **Framework**: Next.js 15.5.3 with TypeScript
- **Styling**: Tailwind CSS 3.4.17
- **UI Components**: Shadcn UI with Zinc theme
- **Icons**: Lucide React
- **Build Tool**: Turbopack

## Usage

1. **Camera Setup**: Allow camera permissions when prompted
2. **Capture Photos**: Click "Start Capturing" to begin the 5-second countdown
3. **Photo Selection**: After capturing 6 photos, select 3 photos for your collage
4. **Apply Filters**: Choose from White, Pink, Black, or Yellow color filters
5. **Download**: Save your final photobooth collage as a PNG file
6. **Take New**: Reset and start over with new photos

## Project Structure

```
src/
├── app/
│   ├── globals.css          # Global styles and theme
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Main application page
├── components/
│   ├── ui/                  # Shadcn UI components
│   ├── Camera.tsx           # Camera component with countdown
│   ├── ThumbnailGallery.tsx # Photo thumbnail display
│   ├── PhotoSelection.tsx   # Photo selection interface
│   ├── FramePreview.tsx     # Final collage preview
│   ├── ColorFilters.tsx    # Color filter controls
│   ├── ActionButtons.tsx    # Download and reset buttons
│   ├── Loading.tsx          # Loading states
│   └── ErrorBoundary.tsx   # Error handling
├── hooks/
│   └── usePhotobooth.ts    # Main application logic
└── types/
    └── photobooth.ts       # TypeScript type definitions
```

## Features in Detail

### Camera Integration
- Real-time video stream with 7:5 aspect ratio
- 5-second countdown with visual animation
- Automatic photo capture and storage
- Canvas-based image processing

### Photo Management
- Store up to 6 captured photos
- Thumbnail gallery with real-time updates
- Photo selection with visual indicators
- Automatic progression to selection phase

### Color Filters
- **White**: Increases brightness and contrast
- **Pink**: Applies pink hue and saturation
- **Black**: Reduces brightness for dramatic effect
- **Yellow**: Adds warm yellow tone
- Real-time preview of filter effects

### Responsive Design
- Desktop: Full camera view with side thumbnails
- Tablet: Optimized layout with adjusted aspect ratios
- Mobile: Stacked layout with touch-friendly controls

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Deployment

The application can be deployed to any platform that supports Next.js:

- **Vercel** (recommended)
- **Netlify**
- **AWS Amplify**
- **Railway**
- **Heroku**

### Environment Variables

No environment variables are required for basic functionality.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Check the browser console for error messages
- Ensure camera permissions are granted
- Verify HTTPS connection for camera access
- Test in different browsers if issues persist
