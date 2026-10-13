import { useEffect, useState } from 'react';
import {
  createOrder,
  createProduct,
  getCategories,
  getMerchantOrders,
  getMyProducts,
} from '../api/merchant.api';
import type {
  CartItem,
  Category,
  CreateOrderResponse,
  MerchantOrder,
  Product,
} from '../merchant.types';
import QRCode from 'qrcode';

type PosView = 'pos' | 'qr' | 'orders';

interface MerchantPosProps {
  merchantName?: string;
  onLogout: () => void;
}

export function MerchantPos({
  merchantName = 'ร้านค้า',
  onLogout,
}: MerchantPosProps) {
  const [view, setView] = useState<PosView>('pos');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<CreateOrderResponse | null>(
    null,
  );
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    productName: '',
    price: '',
    categoryId: '',
    description: '',
  });
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [qrCountdown, setQrCountdown] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;

    Promise.all([getMyProducts(), getCategories()])
      .then(([loadedProducts, loadedCategories]) => {
        if (!isMounted) return;
        setProducts(loadedProducts);
        setCategories(loadedCategories);
      })
      .catch((caughtError: unknown) => {
        if (!isMounted) return;
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'ไม่สามารถโหลดข้อมูลได้',
        );
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // QR countdown timer
  useEffect(() => {
    if (!createdOrder?.qrExpiresAt) return;
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.floor(
          (new Date(createdOrder.qrExpiresAt).getTime() - Date.now()) / 1000,
        ),
      );
      setQrCountdown(remaining);
      if (remaining === 0) setCreatedOrder(null);
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdOrder]);

  const filteredProducts = selectedCategory
    ? products.filter((p) => p.categoryId === selectedCategory)
    : products;

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find(
        (i) => i.product.productId === product.productId,
      );
      if (existing) {
        return prev.map((i) =>
          i.product.productId === product.productId
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.productId === productId
            ? { ...i, quantity: i.quantity + delta }
            : i,
        )
        .filter((i) => i.quantity > 0),
    );
  };

  const handleCreateOrder = async () => {
    if (cart.length === 0) return;
    setIsCreatingOrder(true);
    setError(null);
    try {
      const order = await createOrder({
        items: cart.map((i) => ({
          productId: Number(i.product.productId),
          quantity: i.quantity,
        })),
      });
      setCreatedOrder(order);
      setQrCountdown(
        Math.max(
          0,
          Math.floor(
            (new Date(order.qrExpiresAt).getTime() - Date.now()) / 1000,
          ),
        ),
      );
      // Generate QR code image from the token
      const qrUrl = await QRCode.toDataURL(order.qrToken, {
        width: 300,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      setQrDataUrl(qrUrl);
      setCart([]);
      setView('qr');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ไม่สามารถสร้าง Order ได้');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!newProduct.productName || !newProduct.price || !newProduct.categoryId)
      return;
    setIsSavingProduct(true);
    try {
      const productInput = {
        productName: newProduct.productName,
        price: parseFloat(newProduct.price),
        categoryId: parseInt(newProduct.categoryId),
        ...(newProduct.description
          ? { description: newProduct.description }
          : {}),
      };
      const saved = await createProduct(productInput);
      setProducts((prev) => [saved, ...prev]);
      setNewProduct({
        productName: '',
        price: '',
        categoryId: '',
        description: '',
      });
      setShowAddProduct(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ไม่สามารถบันทึกสินค้าได้');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(n);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-lg shadow-lg">
              🏪
            </div>
            <div>
              <p className="text-xs text-slate-400">Thai Chuay Thai Please</p>
              <h1 className="text-sm font-semibold text-white">
                {merchantName}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex gap-1 rounded-xl bg-slate-800 p-1">
              {(['pos', 'qr', 'orders'] as PosView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    view === v
                      ? 'bg-orange-500 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {v === 'pos' ? '🛒 POS' : v === 'qr' ? '📱 QR' : '📋 Orders'}
                </button>
              ))}
            </nav>
            <button
              onClick={onLogout}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-auto max-w-7xl px-4 pt-3">
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <span>⚠️</span> {error}
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400/60 hover:text-red-400"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-4">
        {/* ── POS VIEW ── */}
        {view === 'pos' && (
          <div className="flex gap-4">
            {/* Product Panel */}
            <div className="flex-1">
              {/* Category filter */}
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    !selectedCategory
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  ทั้งหมด
                </button>
                {categories.map((c) => (
                  <button
                    key={String(c.categoryId)}
                    onClick={() => setSelectedCategory(String(c.categoryId))}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      selectedCategory === String(c.categoryId)
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {c.categoryName}
                  </button>
                ))}
                <button
                  onClick={() => setShowAddProduct(true)}
                  className="ml-auto shrink-0 rounded-full bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-600 hover:text-white transition-colors"
                >
                  + เพิ่มสินค้า
                </button>
              </div>

              {/* Add Product Modal */}
              {showAddProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
                    <h3 className="mb-4 text-base font-semibold text-white">
                      เพิ่มสินค้าใหม่
                    </h3>
                    <div className="space-y-3">
                      <input
                        className="w-full rounded-xl bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="ชื่อสินค้า *"
                        value={newProduct.productName}
                        onChange={(e) =>
                          setNewProduct((p) => ({
                            ...p,
                            productName: e.target.value,
                          }))
                        }
                      />
                      <input
                        className="w-full rounded-xl bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="ราคา (บาท) *"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={newProduct.price}
                        onChange={(e) =>
                          setNewProduct((p) => ({
                            ...p,
                            price: e.target.value,
                          }))
                        }
                      />
                      <select
                        className="w-full rounded-xl bg-slate-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                        value={newProduct.categoryId}
                        onChange={(e) =>
                          setNewProduct((p) => ({
                            ...p,
                            categoryId: e.target.value,
                          }))
                        }
                      >
                        <option value="">เลือกหมวดหมู่ *</option>
                        {categories.map((c) => (
                          <option
                            key={String(c.categoryId)}
                            value={String(c.categoryId)}
                          >
                            {c.categoryName}
                          </option>
                        ))}
                      </select>
                      <input
                        className="w-full rounded-xl bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="รายละเอียด (ไม่บังคับ)"
                        value={newProduct.description}
                        onChange={(e) =>
                          setNewProduct((p) => ({
                            ...p,
                            description: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => setShowAddProduct(false)}
                        className="flex-1 rounded-xl bg-slate-700 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-600 transition-colors"
                      >
                        ยกเลิก
                      </button>
                      <button
                        onClick={() => void handleSaveProduct()}
                        disabled={
                          isSavingProduct ||
                          !newProduct.productName ||
                          !newProduct.price ||
                          !newProduct.categoryId
                        }
                        className="flex-1 rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
                      >
                        {isSavingProduct ? 'กำลังบันทึก...' : 'บันทึก'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {isLoading ? (
                <div className="flex h-48 items-center justify-center">
                  <div className="size-8 animate-spin rounded-full border-4 border-orange-500 border-r-transparent" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-700 text-slate-500">
                  <span className="text-3xl">📦</span>
                  <p className="text-sm">
                    ยังไม่มีสินค้า กดปุ่ม &quot;+ เพิ่มสินค้า&quot;
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredProducts.map((product) => {
                    const inCart = cart.find(
                      (i) => i.product.productId === product.productId,
                    );
                    return (
                      <button
                        key={product.productId}
                        onClick={() => addToCart(product)}
                        className="group relative flex flex-col rounded-2xl border border-slate-700/50 bg-slate-800/50 p-3 text-left transition-all hover:border-orange-500/50 hover:bg-slate-800 hover:shadow-lg hover:shadow-orange-500/5 active:scale-95"
                      >
                        {inCart && (
                          <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
                            {inCart.quantity}
                          </span>
                        )}
                        <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 text-xl">
                          🍽️
                        </div>
                        <p className="text-xs font-medium text-white line-clamp-2">
                          {product.productName}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {product.categoryName}
                        </p>
                        <p className="mt-auto pt-2 text-sm font-bold text-orange-400">
                          {formatCurrency(product.price)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cart Panel */}
            <div className="w-72 shrink-0">
              <div className="sticky top-20 rounded-2xl border border-slate-700/50 bg-slate-900 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">
                    🛒 ตะกร้า
                  </h2>
                  {cart.length > 0 && (
                    <button
                      onClick={() => setCart([])}
                      className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                    >
                      ล้างทั้งหมด
                    </button>
                  )}
                </div>

                {cart.length === 0 ? (
                  <div className="flex h-32 flex-col items-center justify-center gap-2 text-slate-600">
                    <span className="text-2xl">🛒</span>
                    <p className="text-xs">เลือกสินค้าจากด้านซ้าย</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div
                        key={item.product.productId}
                        className="flex items-center gap-2 rounded-xl bg-slate-800 p-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-white">
                            {item.product.productName}
                          </p>
                          <p className="text-xs text-orange-400">
                            {formatCurrency(item.product.price)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              updateQty(item.product.productId, -1)
                            }
                            className="flex size-6 items-center justify-center rounded-lg bg-slate-700 text-xs text-slate-300 hover:bg-slate-600 transition-colors"
                          >
                            −
                          </button>
                          <span className="w-5 text-center text-xs font-bold text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQty(item.product.productId, 1)}
                            className="flex size-6 items-center justify-center rounded-lg bg-slate-700 text-xs text-slate-300 hover:bg-slate-600 transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 border-t border-slate-700 pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm text-slate-400">รวม</span>
                    <span className="text-lg font-bold text-orange-400">
                      {formatCurrency(cartTotal)}
                    </span>
                  </div>
                  <button
                    id="create-order-btn"
                    onClick={() => void handleCreateOrder()}
                    disabled={cart.length === 0 || isCreatingOrder}
                    className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 hover:from-orange-600 hover:to-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    {isCreatingOrder ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="size-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                        กำลังสร้าง...
                      </span>
                    ) : (
                      '📱 สร้าง QR ชำระเงิน'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── QR VIEW ── */}
        {view === 'qr' && (
          <div className="flex flex-col items-center py-6">
            {createdOrder && qrDataUrl ? (
              <div className="w-full max-w-sm">
                <div className="rounded-3xl border border-slate-700/50 bg-gradient-to-b from-slate-800 to-slate-900 p-6 shadow-2xl">
                  <div className="mb-4 text-center">
                    <p className="text-xs text-slate-400">
                      Order #{createdOrder.orderId}
                    </p>
                    <p className="text-2xl font-bold text-orange-400 mt-1">
                      {formatCurrency(createdOrder.finalAmount)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      หมดอายุใน{' '}
                      <span
                        className={`font-mono font-bold ${qrCountdown < 60 ? 'text-red-400' : 'text-green-400'}`}
                      >
                        {formatTime(qrCountdown)}
                      </span>
                    </p>
                  </div>

                  <div className="flex justify-center">
                    <div className="rounded-2xl bg-white p-4 shadow-xl">
                      <img src={qrDataUrl} alt="QR Code" className="size-56" />
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5 rounded-xl bg-slate-800/50 p-3">
                    <p className="text-xs font-medium text-slate-300 mb-2">
                      รายการสินค้า
                    </p>
                    {createdOrder.items.map((item, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-xs text-slate-400"
                      >
                        <span>
                          {item.productName} × {item.quantity}
                        </span>
                        <span>{formatCurrency(item.lineTotal)}</span>
                      </div>
                    ))}
                  </div>

                  <p className="mt-4 text-center text-xs text-slate-500">
                    ให้ลูกค้าสแกน QR Code เพื่อชำระเงิน
                  </p>
                </div>

                <button
                  onClick={() => {
                    setCreatedOrder(null);
                    setQrDataUrl(null);
                    setView('pos');
                  }}
                  className="mt-4 w-full rounded-xl bg-slate-700 py-3 text-sm font-medium text-slate-300 hover:bg-slate-600 transition-colors"
                >
                  ← กลับไปสั่งรายการใหม่
                </button>
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-500">
                <span className="text-4xl">📱</span>
                <p className="text-sm">ยังไม่มี QR Code</p>
                <button
                  onClick={() => setView('pos')}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  ไปสร้าง Order
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── ORDERS VIEW ── */}
        {view === 'orders' && <MerchantOrdersList />}
      </main>
    </div>
  );
}

// ─── Order History Component ───────────────────────────────────────────────────

function MerchantOrdersList() {
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMerchantOrders()
      .then(setOrders)
      .catch((caughtError: unknown) => {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'ไม่สามารถโหลดประวัติ Order ได้',
        );
      })
      .finally(() => setIsLoading(false));
  }, []);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(n);

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-4 border-orange-500 border-r-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-sm font-semibold text-white">
        📋 ประวัติ Orders
      </h2>
      {orders.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700 text-slate-500">
          <span className="text-3xl">📋</span>
          <p className="text-sm">ยังไม่มี Order</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <div
              key={order.orderId}
              className="flex items-center gap-4 rounded-2xl border border-slate-700/50 bg-slate-800/50 px-4 py-3 transition-colors hover:bg-slate-800"
            >
              <div
                className={`flex size-8 shrink-0 items-center justify-center rounded-xl text-sm ${
                  order.status === 'PAID'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}
              >
                {order.status === 'PAID' ? '✓' : '⏳'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white">
                  Order #{order.orderId}
                </p>
                <p className="text-xs text-slate-400">
                  {order.consumerName ?? 'รอลูกค้า'} · {order.itemCount} รายการ
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-orange-400">
                  {formatCurrency(order.finalAmount)}
                </p>
                <p className="text-xs text-slate-500">
                  {order.paidAt
                    ? new Date(order.paidAt).toLocaleTimeString('th-TH', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : new Date(order.createdAt).toLocaleTimeString('th-TH', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
