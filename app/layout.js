import './globals.css';

export const metadata = {
  title: 'Divergent Association Task',
  description: 'Enter 7 unrelated nouns and see how different they are.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
