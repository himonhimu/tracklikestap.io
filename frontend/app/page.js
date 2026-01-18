import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-xl p-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Tracklikestap.io
        </h1>
        <p className="text-gray-600 mb-6">
          Minimal Next.js Analytics for localhost
        </p>
        
        <div className="space-y-4 mb-8">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h2 className="font-semibold text-green-900 mb-2">✓ Features</h2>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• Works with Next.js App Router</li>
              <li>• localhost only</li>
              <li>• No CORS issues</li>
              <li>• No cookies</li>
              <li>• SPA navigation tracking</li>
            </ul>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="font-semibold text-blue-900 mb-2">📊 How it works</h2>
            <p className="text-sm text-blue-800">
              Open your browser DevTools → Network tab. Navigate between pages
              and you&apos;ll see POST requests to the API server endpoint.
              Check the console for logged analytics events.
            </p>
          </div>
        </div>

        <div className="flex gap-4 flex-wrap">
          <Link
            href="/product"
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            View Product (Test Events)
          </Link>
          <Link
            href="/about"
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            Go to About Page
          </Link>
          <Link
            href="/contact"
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Go to Contact Page
          </Link>
        </div>
      </div>
    </div>
  );
}
