import { AuroMinaProvider } from '@/context/MinaProviderContext'
import './global.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuroMinaProvider>
          {children}
        </AuroMinaProvider>
      </body>
    </html>
  )
}