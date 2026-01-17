import { sendGTMEvent } from "@next/third-parties/google";
import { useCallback } from "react";
// Replace with your actual GTM import

/**
 * Custom hook for sending Google Tag Manager events related to e-commerce
 * @returns {Object} Functions for tracking various e-commerce events
 */
export function useGTMTracking() {
  const trackAddToCart = useCallback((product, quantity) => {
    if (!product) return;
    const gtmData = {
      ecommerce: {
        currency: "BDT",
        value: product.offer_price,
        items: [
          {
            id: product.product_id,
            item_id: product.product_id,
            item_name: product.product_name,
            item_brand: "",
            item_category: product.category_name,
            price: product.offer_price,
            quantity: quantity || 1,
          },
        ],
      },
    };

    sendGTMEvent({ event: "add_to_cart", ...gtmData });
  }, []);
  const trackRemoveFromCart = useCallback((product, quantity) => {
    if (!product) return;
    const gtmData = {
      ecommerce: {
        currency: "BDT",
        value: product.offer_price,
        items: [
          {
            id: product.product_id,
            item_id: product.product_id,
            item_name: product.product_name,
            item_brand: "",
            item_category: product.category_name,
            price: product.offer_price,
            quantity: quantity || 1,
          },
        ],
      },
    };

    sendGTMEvent({ event: "remove_from_cart", ...gtmData });
  }, []);

  const trackBeginCheckout = useCallback((items) => {
    if (!items || !items.length) return;
    const organizedItems = items.map((item, index) => {
      return {
        item_id: item.product_id,
        item_name: item.product_name,
        price: item.offer_price,
        item_category: item.category_name,
        id: item.product_id,
        quantity: item.quantity || 1,
      };
    });

    const valueFind = items.map((product) => {
      return {
        item_id: product.product_id,
        item_name: product.product_name,
        price: product.offer_price,
        item_category: product.category_name,
        id: product.product_id,
        quantity: product.quantity || 1,
      };
    });
    const gtmData = {
      ecommerce: {
        currency: "BDT",
        value: calculateTotalValue(valueFind),
        items: organizedItems,
      },
    };

    sendGTMEvent({ event: "begin_checkout", ...gtmData });
  }, []);

  const trackViewCart = useCallback((items) => {
    if (!items || !items.length) return;
    const organizedItems = items.map((item, index) => {
      return {
        item_id: item.product_id,
        item_name: item.product_name,
        price: item.offer_price,
        item_category: item.category_name,
        id: item.product_id,
        quantity: item.quantity || 1,
      };
    });

    const valueFind = items.map((product) => {
      return {
        item_id: product.product_id,
        item_name: product.product_name,
        price: product.offer_price,
        item_category: product.category_name,
        id: product.product_id,
        quantity: product.quantity || 1,
      };
    });
    const gtmData = {
      ecommerce: {
        currency: "BDT",
        value: calculateTotalValue(valueFind),
        items: organizedItems,
      },
    };

    sendGTMEvent({ event: "view_cart", ...gtmData });
  }, []);

  const trackViewItem = useCallback((product) => {
    if (!product) {
      return;
    }
    const gtmData = {
      ecommerce: {
        currency: "BDT",
        value: product.offer_price,
        items: [
          {
            id: product.product_id,
            item_id: product.product_id,
            item_name: product.product_name,
            item_brand: "",
            item_category: product.category_name,
            price: product.offer_price,
            quantity: 1,
          },
        ],
      },
    };

    sendGTMEvent({ event: "view_item", ...gtmData });
  }, []);

  const trackPurchase = useCallback(
    (customer_name, customer_phone, items, orderInfo) => {
      if (!items || !items.length) return;

      const organizedItems = items.map((product) => {
        return {
          item_id: product.product_id,
          item_name: product.product_name,
          price: product.offer_price,
          item_category: product.category_name,
          id: product.product_id,
          quantity: product.quantity || 1,
        };
      });

      const gtmData = {
        ecommerce: {
          transaction_id: orderInfo.insertId,
          value: calculateTotalValue(organizedItems),
          shipping: 0,
          currency: "BDT",
          browserName: "",
          customerBillingPhone: customer_phone,
          customerFirstName: customer_name,
          customerLastName: customer_name,
          customerBillingCity: "",
          customerBillingCountry: "BD",
          items: organizedItems,
        },
      };

      sendGTMEvent({ event: "purchase", ...gtmData });
    },
    []
  );

  const trackCartAction = useCallback(
    (product, isCheckout, finalItems, quantity = 1, isExist = false) => {
      // Track add to cart
      if (!isExist && product) {
        trackAddToCart(product, quantity);
      }

      // Track begin checkout if needed
      if (isCheckout && finalItems) {
        trackBeginCheckout(finalItems);
      }
    },
    [trackAddToCart, trackBeginCheckout]
  );

  // Helper function to calculate total value from items
  const calculateTotalValue = useCallback((items) => {
    return items.reduce((total, item) => {
      return total + item.price * item.quantity;
    }, 0);
  }, []);

  return {
    trackAddToCart,
    trackBeginCheckout,
    trackCartAction,
    trackViewCart,
    trackPurchase,
    trackRemoveFromCart,
    trackViewItem,
  };
}
