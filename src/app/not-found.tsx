// Fallback for requests outside any locale (the proxy normally redirects them).
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <h1>Page not found</h1>
        <p>
          <a href="/">TradeCheck</a>
        </p>
      </body>
    </html>
  );
}
