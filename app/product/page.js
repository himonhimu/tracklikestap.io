"use client";

import Link from "next/link";
import { useState } from "react";

export default function ProductPage() {
  const [addedToCart, setAddedToCart] = useState(false);
  const [purchased, setPurchased] = useState(false);

  const product = {
    id: "prod_123",
    name: "Premium Wireless Headphones",
    price: 99.99,
    currency: "USD",
    category: "Electronics",
    image: "https://via.placeholder.com/400x400?text=Headphones",
  };

  const trackEvent = async (eventName, eventData = {}) => {
    try {
      await fetch("/api/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: eventName,
          path: location.pathname,
          referrer: document.referrer || null,
          ua: navigator.userAgent,
          ts: Date.now(),
          ...eventData,
        }),
      });
    } catch (err) {
      console.error("[analytics] Failed to send event:", err);
    }
  };

  const handleAddToCart = () => {
    trackEvent("AddToCart", {
      product: {
        id: product.id,
        name: product.name,
        price: product.price,
        currency: product.currency,
        category: product.category,
      },
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handlePurchase = () => {
    trackEvent("Purchase", {
      value: product.price,
      currency: product.currency,
      products: [
        {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          category: product.category,
        },
      ],
    });
    setPurchased(true);
    setTimeout(() => setPurchased(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="inline-block mb-6 text-indigo-600 hover:text-indigo-800 font-medium"
        >
          ← Back to Home
        </Link>

        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="md:flex">
            {/* Product Image */}
            <div className="md:w-1/2 bg-gray-100 flex items-center justify-center p-8">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-auto max-w-sm object-cover"
              />
            </div>

            {/* Product Details */}
            <div className="md:w-1/2 p-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {product.name}
              </h1>
              <p className="text-gray-600 mb-6">
                Experience premium sound quality with our wireless headphones.
                Perfect for music lovers and professionals alike.
              </p>

              <div className="mb-6">
                <span className="text-4xl font-bold text-indigo-600">
                  ${product.price}
                </span>
                <span className="text-gray-500 ml-2">USD</span>
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleAddToCart}
                  className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-lg"
                >
                  {addedToCart ? "✓ Added to Cart!" : "Add to Cart"}
                </button>

                <button
                  onClick={handlePurchase}
                  className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-lg"
                >
                  {purchased ? "✓ Purchase Complete!" : "Buy Now"}
                </button>
              </div>

              <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">
                  🧪 Testing Events
                </h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Click "Add to Cart" → triggers AddToCart event</li>
                  <li>• Click "Buy Now" → triggers Purchase event</li>
                  <li>• Check DevTools → Network → /api/event</li>
                  <li>• Check server console for FB Pixel logs</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
