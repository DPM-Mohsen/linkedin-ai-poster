export const metadata = {
  title: "LinkedIn AI Poster",
  description: "AI-powered LinkedIn post generator for Salesforce PMs",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "#0d0d14" }}>{children}</body>
    </html>
  );
}
