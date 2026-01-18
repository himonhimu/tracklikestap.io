import Link from "next/link";

export default function About() {
  return (
    <div className="min-h-screen bg-linear-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-xl p-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">About Page</h1>
        <p className="text-gray-600 mb-6">
          This page is tracked by the analytics script. Check your console and
          network tab to see the tracking events.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
