import localFont from "next/font/local";
import "./globals.css";

export const metadata = {
  title: "SmartHome Controller",
  description: "Control devices in your smart home.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <h1>SmartHome Dashboard</h1>
        {children}
      </body>
    </html>
  );
}
