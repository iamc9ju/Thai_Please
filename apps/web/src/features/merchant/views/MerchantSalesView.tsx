import { useState, type Dispatch, type SetStateAction } from 'react';
import { Edit3, Plus, Power, Settings2, ShoppingCart } from 'lucide-react';
import { th } from '../../../i18n/th';
import type { CartItem, Category, Product } from '../merchant.types';

type ProductStatusFilter = 'ACTIVE' | 'INACTIVE' | 'ALL';

interface NewProductForm {
  productName: string;
  price: string;
  categoryId: string;
  description: string;
}

interface EditProductForm extends NewProductForm {
  status: 'ACTIVE' | 'INACTIVE';
}

interface MerchantSalesViewProps {
  categories: Category[];
  filterCategories: Category[];
  selectedCategory: string | null;
  setSelectedCategory: Dispatch<SetStateAction<string | null>>;
  isManageMode: boolean;
  setIsManageMode: Dispatch<SetStateAction<boolean>>;
  productStatusFilter: ProductStatusFilter;
  setProductStatusFilter: Dispatch<SetStateAction<ProductStatusFilter>>;
  productCounts: { active: number; inactive: number; all: number };
  showAddProduct: boolean;
  setShowAddProduct: Dispatch<SetStateAction<boolean>>;
  newProduct: NewProductForm;
  setNewProduct: Dispatch<SetStateAction<NewProductForm>>;
  isSavingProduct: boolean;
  handleSaveProduct: () => Promise<void>;
  editingProduct: Product | null;
  setEditingProduct: Dispatch<SetStateAction<Product | null>>;
  editForm: EditProductForm;
  setEditForm: Dispatch<SetStateAction<EditProductForm>>;
  isUpdatingProduct: boolean;
  handleUpdateProduct: () => Promise<void>;
  isLoading: boolean;
  filteredProducts: Product[];
  togglingProductId: string | null;
  addToCart: (product: Product) => void;
  handleOpenEditProduct: (product: Product) => void;
  handleToggleProductStatus: (product: Product) => Promise<void>;
  formatCurrency: (value: number) => string;
  cart: CartItem[];
  setCart: Dispatch<SetStateAction<CartItem[]>>;
  updateQty: (productId: string, delta: number) => void;
  cartTotal: number;
  handleCreateOrder: () => Promise<void>;
  isCreatingOrder: boolean;
}

export function MerchantSalesView({
  categories,
  filterCategories,
  selectedCategory,
  setSelectedCategory,
  isManageMode,
  setIsManageMode,
  productStatusFilter,
  setProductStatusFilter,
  productCounts,
  showAddProduct,
  setShowAddProduct,
  newProduct,
  setNewProduct,
  isSavingProduct,
  handleSaveProduct,
  editingProduct,
  setEditingProduct,
  editForm,
  setEditForm,
  isUpdatingProduct,
  handleUpdateProduct,
  isLoading,
  filteredProducts,
  togglingProductId,
  addToCart,
  handleOpenEditProduct,
  handleToggleProductStatus,
  formatCurrency,
  cart,
  setCart,
  updateQty,
  cartTotal,
  handleCreateOrder,
  isCreatingOrder,
}: MerchantSalesViewProps) {
  const posCopy = th.merchantPortal.pos;
  const [pendingDeactivateProduct, setPendingDeactivateProduct] =
    useState<Product | null>(null);

  const confirmDeactivateProduct = async () => {
    if (!pendingDeactivateProduct) return;
    await handleToggleProductStatus(pendingDeactivateProduct);
    setPendingDeactivateProduct(null);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Product Panel */}
      <div className="flex-1">
        {/* Top Toolbar: Category filter + Manage Mode & Add Product */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {filterCategories.length > 0 && (
            <div
              role="group"
              aria-label="ตัวกรองหมวดหมู่สินค้า"
              className="flex flex-wrap items-center gap-2"
            >
              {filterCategories.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    !selectedCategory
                      ? 'bg-[#0056b3] text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-[#0056b3] hover:text-[#0056b3]'
                  }`}
                >
                  ทั้งหมด
                </button>
              )}
              {filterCategories.map((category) => (
                <button
                  key={String(category.categoryId)}
                  type="button"
                  onClick={() =>
                    setSelectedCategory(String(category.categoryId))
                  }
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    selectedCategory === String(category.categoryId)
                      ? 'bg-[#0056b3] text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-[#0056b3] hover:text-[#0056b3]'
                  }`}
                >
                  {category.categoryName}
                </button>
              ))}
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const nextMode = !isManageMode;
                setIsManageMode(nextMode);
                if (nextMode) {
                  setProductStatusFilter('ALL');
                } else {
                  setProductStatusFilter('ACTIVE');
                }
              }}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                isManageMode
                  ? 'bg-[#003d82] text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-700 hover:border-[#0056b3] hover:text-[#0056b3]'
              }`}
            >
              <Settings2 className="size-3.5" />
              <span>
                {isManageMode
                  ? posCopy.exitManageProducts
                  : posCopy.manageProductsToggle}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddProduct(true)}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-3.5 py-1.5 text-xs font-bold text-[#0056b3] hover:bg-blue-100 transition-colors cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>{posCopy.addProductButton}</span>
            </button>
          </div>
        </div>

        {/* Status Filter Bar (FR-M02) */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-bold text-slate-500">
              สถานะสินค้า:
            </span>
            {(
              [
                {
                  id: 'ACTIVE',
                  label: `${posCopy.filterActive} (${productCounts.active})`,
                },
                {
                  id: 'INACTIVE',
                  label: `${posCopy.filterInactive} (${productCounts.inactive})`,
                },
                {
                  id: 'ALL',
                  label: `${posCopy.filterAll} (${productCounts.all})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setProductStatusFilter(tab.id);
                  setSelectedCategory(null);
                }}
                className={`rounded-xl px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                  productStatusFilter === tab.id
                    ? 'bg-[#0056b3] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-slate-500">
            💡 กดปุ่ม <strong>แก้ไข</strong> หรือ <strong>ปิดการขาย</strong>{' '}
            บนการ์ดสินค้าได้ทันทีโดยไม่กระทบใบเสร็จย้อนหลัง
          </span>
        </div>

        {/* Add Product Modal */}
        {showAddProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
              <h3 className="mb-4 text-base font-extrabold text-slate-900">
                {posCopy.addModalTitle}
              </h3>
              <div className="space-y-3">
                <input
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#0056b3] focus:bg-white focus:outline-none"
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
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#0056b3] focus:bg-white focus:outline-none"
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
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#0056b3] focus:bg-white focus:outline-none"
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
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#0056b3] focus:bg-white focus:outline-none"
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
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddProduct(false)}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveProduct()}
                  disabled={
                    isSavingProduct ||
                    !newProduct.productName ||
                    !newProduct.price ||
                    !newProduct.categoryId
                  }
                  className="flex-1 rounded-xl bg-[#0056b3] py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#004494] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isSavingProduct ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Product Modal (FR-M02) */}
        {editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
              <h3 className="mb-1 text-base font-extrabold text-slate-900">
                {posCopy.editModalTitle}
              </h3>
              <p className="mb-4 text-xs text-slate-500">
                {posCopy.immutableSnapshotNote}
              </p>
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="edit-product-name"
                    className="mb-1 block text-xs font-bold text-slate-700"
                  >
                    ชื่อสินค้า *
                  </label>
                  <input
                    id="edit-product-name"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#0056b3] focus:bg-white focus:outline-none"
                    value={editForm.productName}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        productName: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-product-price"
                    className="mb-1 block text-xs font-bold text-slate-700"
                  >
                    ราคา (บาท) *
                  </label>
                  <input
                    id="edit-product-price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#0056b3] focus:bg-white focus:outline-none"
                    value={editForm.price}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        price: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-product-category"
                    className="mb-1 block text-xs font-bold text-slate-700"
                  >
                    หมวดหมู่สินค้า *
                  </label>
                  <select
                    id="edit-product-category"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#0056b3] focus:bg-white focus:outline-none"
                    value={editForm.categoryId}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        categoryId: e.target.value,
                      }))
                    }
                  >
                    {categories.map((c) => (
                      <option
                        key={String(c.categoryId)}
                        value={String(c.categoryId)}
                      >
                        {c.categoryName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="edit-product-description"
                    className="mb-1 block text-xs font-bold text-slate-700"
                  >
                    รายละเอียดสินค้า
                  </label>
                  <input
                    id="edit-product-description"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#0056b3] focus:bg-white focus:outline-none"
                    placeholder="รายละเอียด (ไม่บังคับ)"
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-product-status"
                    className="mb-1 block text-xs font-bold text-slate-700"
                  >
                    สถานะการจำหน่าย
                  </label>
                  <select
                    id="edit-product-status"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#0056b3] focus:bg-white focus:outline-none"
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        status:
                          e.target.value === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
                      }))
                    }
                  >
                    <option value="ACTIVE">พร้อมขายหน้าร้าน (ACTIVE)</option>
                    <option value="INACTIVE">
                      ปิดการขายชั่วคราว (INACTIVE)
                    </option>
                  </select>
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => void handleUpdateProduct()}
                  disabled={
                    isUpdatingProduct ||
                    !editForm.productName.trim() ||
                    !editForm.price ||
                    !editForm.categoryId
                  }
                  className="flex-1 rounded-xl bg-[#0056b3] py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#004494] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isUpdatingProduct ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex h-48 items-center justify-center rounded-3xl border border-slate-200/80 bg-white">
            <div className="size-8 animate-spin rounded-full border-4 border-[#0056b3] border-r-transparent" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white text-slate-500">
            <span className="text-3xl">📦</span>
            <p className="text-sm font-medium">
              ไม่พบสินค้าในตัวกรองนี้ หรือกดปุ่ม &quot;+ เพิ่มสินค้า&quot;
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => {
              const inCart = cart.find(
                (i) => i.product.productId === product.productId,
              );
              const isInactive = product.status === 'INACTIVE';
              const isToggling = togglingProductId === product.productId;

              return (
                <div
                  key={product.productId}
                  className={`group relative flex flex-col justify-between rounded-2xl border p-4 text-left shadow-sm transition-all ${
                    isInactive
                      ? 'border-slate-200 bg-slate-100/80 opacity-85'
                      : 'border-slate-200/80 bg-white hover:border-[#0056b3] hover:shadow-md'
                  }`}
                >
                  {/* Clickable area to add to POS cart */}
                  <button
                    type="button"
                    disabled={isInactive}
                    onClick={() => addToCart(product)}
                    className={`flex flex-1 flex-col text-left ${
                      isInactive
                        ? 'cursor-not-allowed'
                        : 'cursor-pointer active:scale-98'
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-50 text-xl">
                        🍽️
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            isInactive
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isInactive
                            ? posCopy.statusInactiveBadge
                            : posCopy.statusActiveBadge}
                        </span>
                        {inCart && (
                          <span className="flex size-6 items-center justify-center rounded-full bg-[#0056b3] text-xs font-extrabold text-white shadow-sm">
                            {inCart.quantity}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-sm font-bold text-slate-900 line-clamp-2">
                      {product.productName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {product.categoryName}
                    </p>
                    {product.description && (
                      <p className="mt-1 text-[11px] text-slate-400 line-clamp-1">
                        {product.description}
                      </p>
                    )}
                    <p className="mt-auto pt-3 font-mono text-base font-extrabold text-[#0056b3]">
                      {formatCurrency(product.price)}
                    </p>
                  </button>

                  {/* Product Management Actions (FR-M02: Edit & Activate/Deactivate) */}
                  <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditProduct(product)}
                      aria-label={`แก้ไข ${product.productName}`}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:border-[#0056b3] hover:bg-blue-50 hover:text-[#0056b3] transition-colors cursor-pointer"
                    >
                      <Edit3 className="size-3" />
                      <span>{posCopy.editProductButton}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => {
                        if (isInactive) {
                          void handleToggleProductStatus(product);
                          return;
                        }
                        setPendingDeactivateProduct(product);
                      }}
                      aria-label={
                        isInactive
                          ? `เปิดขาย ${product.productName}`
                          : `ปิดการขาย ${product.productName}`
                      }
                      className={`inline-flex flex-1 items-center justify-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                        isInactive
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                      }`}
                    >
                      <Power className="size-3" />
                      <span>
                        {isToggling
                          ? '...'
                          : isInactive
                            ? posCopy.activateButton
                            : posCopy.deactivateButton}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart Panel */}
      <div className="w-full lg:w-80 shrink-0">
        <div className="sticky top-20 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
              <ShoppingCart className="size-4 text-[#0056b3]" />
              <span>ตะกร้าสร้างรายการขาย</span>
            </h2>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className="text-xs font-semibold text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
              >
                ล้างทั้งหมด
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="flex h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-slate-400">
              <ShoppingCart className="size-6" />
              <p className="text-xs font-medium">เลือกสินค้าจากด้านซ้าย</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div
                  key={item.product.productId}
                  className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-900">
                      {item.product.productName}
                    </p>
                    <p className="font-mono text-xs font-semibold text-[#0056b3]">
                      {formatCurrency(item.product.price)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateQty(item.product.productId, -1)}
                      className="flex size-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-xs font-extrabold text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.product.productId, 1)}
                      className="flex size-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-600">
                รวมทั้งสิ้น
              </span>
              <span className="font-mono text-xl font-black text-[#0056b3]">
                {formatCurrency(cartTotal)}
              </span>
            </div>
            <button
              id="create-order-btn"
              type="button"
              onClick={() => void handleCreateOrder()}
              disabled={cart.length === 0 || isCreatingOrder}
              className="w-full rounded-2xl bg-gradient-to-r from-[#003d82] via-[#0056b3] to-[#0073e6] py-3.5 text-sm font-bold text-white shadow-md shadow-blue-900/15 hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
            >
              {isCreatingOrder ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                  กำลังสร้าง QR...
                </span>
              ) : (
                'สร้าง QR ชำระเงิน'
              )}
            </button>
          </div>
        </div>
      </div>

      {pendingDeactivateProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="deactivate-product-dialog-title"
            className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Power className="size-6" />
            </div>
            <h3
              id="deactivate-product-dialog-title"
              className="mt-4 text-center text-lg font-extrabold text-slate-900"
            >
              ยืนยันปิดการขาย
            </h3>
            <p className="mt-2 text-center text-sm leading-6 text-slate-600">
              ต้องการปิดการขายสินค้า{' '}
              <strong>
                &quot;{pendingDeactivateProduct.productName}&quot;
              </strong>{' '}
              ใช่หรือไม่? สินค้าจะไม่สามารถเลือกขายในหน้า POS
              จนกว่าจะเปิดขายอีกครั้ง
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setPendingDeactivateProduct(null)}
                disabled={
                  togglingProductId === pendingDeactivateProduct.productId
                }
                className="flex-1 rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void confirmDeactivateProduct()}
                disabled={
                  togglingProductId === pendingDeactivateProduct.productId
                }
                className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:opacity-50"
              >
                {togglingProductId === pendingDeactivateProduct.productId
                  ? 'กำลังปิดการขาย...'
                  : 'ยืนยันปิดการขาย'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
