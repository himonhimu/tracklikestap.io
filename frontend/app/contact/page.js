import Link from "next/link";

export default function Contact() {
  return (
    <div className="min-h-screen bg-linear-to-br from-green-50 to-teal-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-xl p-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Contact Page</h1>
        <p className="text-gray-600 mb-6">
          Navigate between pages to test SPA navigation tracking. Each route
          change triggers an analytics event.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
