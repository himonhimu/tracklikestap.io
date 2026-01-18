"use client";

import Link from "next/link";
import { useState } from "react";
// import { useGTMTracking } from "../../lib/useGTMTracking";
import { trackAddToCart, trackPurchase, generateEventId } from "../../lib/analytics";

// Send event to Facebook Pixel with event_id
function sendToFacebookPixel(eventName, eventData, eventId) {
  if (typeof window !== "undefined" && window.fbq) {
    // Map event names to Facebook Pixel event names
    const fbEventMap = {
      PageView: "PageView",
      AddToCart: "AddToCart",
      Purchase: "Purchase",
    };
    
    const fbEventName = fbEventMap[eventName] || eventName;
    
    // Prepare Facebook Pixel parameters
    let params = {};
    if (eventName === "AddToCart" && eventData.product) {
      params = {
        content_name: eventData.product.name,
        content_ids: [eventData.product.id],
        content_type: "product",
        value: eventData.product.price,
        currency: eventData.product.currency || "USD",
      };
    } else if (eventName === "Purchase" && eventData.products) {
      const totalValue = eventData.value || eventData.products.reduce(
        (sum, p) => sum + p.price * (p.quantity || 1),
        0
      );
      params = {
        content_ids: eventData.products.map((p) => p.id),
        content_type: "product",
        value: totalValue,
        currency: eventData.currency || "USD",
        num_items: eventData.products.reduce(
          (sum, p) => sum + (p.quantity || 1),
          0
        ),
      };
    }
    
    // Send to Facebook Pixel with event_id for deduplication
    window.fbq("track", fbEventName, params, { eventID: eventId });
  }
}

export default function ProductPage() {
  const [addedToCart, setAddedToCart] = useState(false);
  const [purchased, setPurchased] = useState(false);
  // const { trackAddToCart, trackPurchase } = useGTMTracking();

  const product = {
    id: "prod_123",
    name: "Premium Wireless Headphones",
    price: 99.99,
    currency: "USD",
    category: "Electronics",
    image: "https://via.placeholder.com/400x400?text=Headphones",
  };

  const handleAddToCart = async () => {
    try {
      const eventId = generateEventId();
      
      // Send to Facebook Pixel
      sendToFacebookPixel("AddToCart", {
        product: {
          id: product.id,
          name: product.name,
          price: product.price,
          currency: product.currency,
        },
      }, eventId);
      
      // Send to server API
      // await trackAddToCart({
      //   id: product.id,
      //   name: product.name,
      //   price: product.price,
      //   currency: product.currency,
      //   category: product.category,
      // });
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies for _fbp and _fbc
        body: JSON.stringify({
          event: "AddToCart",
          event_id: eventId,
          path: window.location.pathname,
          url: window.location.href, // Send full URL
          referrer: document.referrer || null,
          ua: navigator.userAgent,
          ts: Date.now(),
          product: {
            id: product.id,
            name: product.name,
            price: product.price,
            currency: product.currency,
          },
        }),
      });
      
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    } catch (err) {
      console.error("[analytics] Failed to track AddToCart:", err);
    }
  };

  const handlePurchase = async () => {
    try {
      const eventId = generateEventId();
      
      // Send to Facebook Pixel
      sendToFacebookPixel("Purchase", {
        value: product.price,
        currency: product.currency,
        products: [
          {
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
          },
        ],
      }, eventId);
      
      // Send to server API
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies for _fbp and _fbc
        body: JSON.stringify({
          event: "Purchase",
          event_id: eventId,
          path: window.location.pathname,
          url: window.location.href, // Send full URL
          referrer: document.referrer || null,
          ua: navigator.userAgent,
          ts: Date.now(),
          value: product.price,
          currency: product.currency,
          products: [
            {
              id: product.id,
              name: product.name,
              price: product.price,
              quantity: 1,
            },
          ],
        }),
      });
      
      setPurchased(true);
      setTimeout(() => setPurchased(false), 3000);
    } catch (err) {
      console.error("[analytics] Failed to track Purchase:", err);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-purple-50 to-pink-100 py-12 px-4">
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
                  <li>• Check DevTools → Network → API server endpoint</li>
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
