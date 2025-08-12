import React, { useState, useEffect } from 'react';
import { Package, Plus, Minus, Scan, Save, Trash2, ArrowUp, ArrowDown, Search, Database } from 'lucide-react';

// 브라우저 저장소 서비스 (가장 쉬운 방법!)
class LocalStorageService {
  constructor() {
    this.storageKey = 'inventory_management_data';
    this.initializeData();
  }

  // 초기 데이터 설정
  initializeData() {
    const savedData = this.getData();
    if (!savedData.products.length) {
      const initialData = {
        products: [
          { id: 1, barcode: '1234567890', name: '삼성 갤럭시 S24', stock: 50, minStock: 10 },
          { id: 2, barcode: '9876543210', name: 'iPhone 15 Pro', stock: 30, minStock: 5 },
          { id: 3, barcode: '1111222233', name: 'LG 그램 노트북', stock: 15, minStock: 8 },
        ],
        transactions: [],
        dailyOutbound: []
      };
      this.saveData(initialData);
    }
  }

  // 데이터 불러오기
  getData() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : { products: [], transactions: [], dailyOutbound: [] };
    } catch (error) {
      console.error('데이터 불러오기 실패:', error);
      return { products: [], transactions: [], dailyOutbound: [] };
    }
  }

  // 데이터 저장하기
  saveData(data) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('데이터 저장 실패:', error);
      return false;
    }
  }

  // 제품 추가
  addProduct(product) {
    const data = this.getData();
    const newProduct = {
      ...product,
      id: Date.now(),
      stock: parseInt(product.stock) || 0,
      minStock: parseInt(product.minStock) || 5
    };
    data.products.push(newProduct);
    this.saveData(data);
    return newProduct;
  }

  // 재고 업데이트
  updateStock(productId, newStock) {
    const data = this.getData();
    data.products = data.products.map(p => 
      p.id === productId ? { ...p, stock: newStock } : p
    );
    this.saveData(data);
  }

  // 거래 기록 추가
  addTransaction(transaction) {
    const data = this.getData();
    const newTransaction = {
      ...transaction,
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString(),
      date: transaction.date || new Date().toISOString().split('T')[0]
    };
    data.transactions.unshift(newTransaction);
    this.saveData(data);
    return newTransaction;
  }

  // 일일 출고 목록 업데이트
  updateDailyOutbound(outboundList) {
    const data = this.getData();
    data.dailyOutbound = outboundList;
    this.saveData(data);
  }

  // 데이터 내보내기 (백업용)
  exportData() {
    const data = this.getData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 데이터 초기화
  clearAllData() {
    if (confirm('⚠️ 모든 데이터가 삭제됩니다. 정말 초기화하시겠습니까?')) {
      localStorage.removeItem(this.storageKey);
      this.initializeData();
      return true;
    }
    return false;
  }
}

// 로컬 저장소 서비스 인스턴스
const storage = new LocalStorageService();

const InventoryManagementApp = () => {
  // 상태 관리
  const [activeTab, setActiveTab] = useState('stock');
  const [products, setProducts] = useState([]);
  const [dailyOutbound, setDailyOutbound] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [barcodeInput, setBarcodeInput] = useState('');
  const [newProduct, setNewProduct] = useState({ barcode: '', name: '', stock: 0, minStock: 5 });
  const [inboundData, setInboundData] = useState({ productId: '', quantity: 1, date: new Date().toISOString().split('T')[0] });
  const [productSearch, setProductSearch] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [showProductList, setShowProductList] = useState(false);
  const [scanning, setScanning] = useState(false);

  // 데이터 로드
  const loadData = () => {
    const data = storage.getData();
    setProducts(data.products);
    setDailyOutbound(data.dailyOutbound);
    setTransactions(data.transactions);
  };

  // 컴포넌트 마운트시 데이터 로드
  useEffect(() => {
    loadData();
  }, []);

  // 제품 검색 필터링
  useEffect(() => {
    if (productSearch) {
      const filtered = products.filter(product => 
        product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        product.barcode.includes(productSearch)
      );
      setFilteredProducts(filtered);
      setShowProductList(filtered.length > 0);
    } else {
      setFilteredProducts([]);
      setShowProductList(false);
    }
  }, [productSearch, products]);

  // 제품 선택
  const selectProduct = (product) => {
    setProductSearch(product.name);
    setInboundData({...inboundData, productId: product.id});
    setShowProductList(false);
  };

  // 알림 표시
  const showNotification = (message, type = 'success') => {
    const emoji = type === 'error' ? '❌' : '✅';
    alert(`${emoji} ${message}`);
  };

  // 바코드로 제품 찾기
  const findProductByBarcode = (barcode) => {
    return products.find(p => p.barcode === barcode);
  };

  // 바코드 스캔 처리
  const handleBarcodeScan = (barcode) => {
    if (!barcode.trim()) return;
    
    const product = findProductByBarcode(barcode);
    if (product) {
      addToOutboundList(product);
      setBarcodeInput('');
      showNotification(`${product.name}이(가) 출고 목록에 추가되었습니다.`);
    } else {
      showNotification(`바코드 ${barcode}에 해당하는 제품을 찾을 수 없습니다.`, 'error');
    }
  };

  // 출고 목록에 추가
  const addToOutboundList = (product) => {
    const existing = dailyOutbound.find(item => item.id === product.id);
    let newOutboundList;
    
    if (existing) {
      newOutboundList = dailyOutbound.map(item => 
        item.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      newOutboundList = [...dailyOutbound, { ...product, quantity: 1 }];
    }
    
    storage.updateDailyOutbound(newOutboundList);
    setDailyOutbound(newOutboundList);
  };

  // 출고 목록 수량 조정
  const adjustOutboundQuantity = (productId, change) => {
    const newOutboundList = dailyOutbound.map(item => {
      if (item.id === productId) {
        const newQuantity = Math.max(0, item.quantity + change);
        return newQuantity === 0 ? null : { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(Boolean);
    
    storage.updateDailyOutbound(newOutboundList);
    setDailyOutbound(newOutboundList);
  };

  // 출고 처리
  const processOutbound = () => {
    if (dailyOutbound.length === 0) {
      showNotification('출고할 제품이 없습니다.', 'error');
      return;
    }

    setLoading(true);
    
    try {
      const today = new Date().toISOString().split('T')[0];

      // 각 제품별 재고 업데이트 및 거래 기록
      dailyOutbound.forEach(outboundItem => {
        const product = products.find(p => p.id === outboundItem.id);
        if (product) {
          // 재고 업데이트
          const newStock = Math.max(0, product.stock - outboundItem.quantity);
          storage.updateStock(product.id, newStock);
          
          // 거래 기록 추가
          storage.addTransaction({
            productId: product.id,
            productName: product.name,
            type: 'OUT',
            quantity: outboundItem.quantity,
            date: today
          });
        }
      });

      // 출고 목록 초기화
      storage.updateDailyOutbound([]);
      
      // 화면 업데이트
      loadData();
      
      showNotification(`${dailyOutbound.length}개 제품이 출고 처리되었습니다.`);
    } catch (error) {
      showNotification('출고 처리 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 입고 처리
  const processInbound = () => {
    if (!inboundData.productId || inboundData.quantity <= 0) {
      showNotification('제품과 수량을 정확히 입력해주세요.', 'error');
      return;
    }

    const product = products.find(p => p.id === parseInt(inboundData.productId));
    if (!product) {
      showNotification('제품을 찾을 수 없습니다.', 'error');
      return;
    }

    setLoading(true);

    try {
      // 재고 업데이트
      const newStock = product.stock + parseInt(inboundData.quantity);
      storage.updateStock(product.id, newStock);

      // 거래 기록 추가
      storage.addTransaction({
        productId: product.id,
        productName: product.name,
        type: 'IN',
        quantity: parseInt(inboundData.quantity),
        date: inboundData.date
      });

      // 화면 업데이트
      loadData();

      // 입력 폼 초기화
      setInboundData({ 
        productId: '', 
        quantity: 1, 
        date: new Date().toISOString().split('T')[0] 
      });
      setProductSearch('');

      showNotification(`${product.name} ${inboundData.quantity}개가 입고 처리되었습니다.`);
    } catch (error) {
      showNotification('입고 처리 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 새 제품 추가
  const addNewProduct = () => {
    if (!newProduct.barcode || !newProduct.name) {
      showNotification('바코드와 제품명을 입력해주세요.', 'error');
      return;
    }

    if (products.some(p => p.barcode === newProduct.barcode)) {
      showNotification('이미 존재하는 바코드입니다.', 'error');
      return;
    }

    setLoading(true);

    try {
      storage.addProduct(newProduct);
      loadData();
      setNewProduct({ barcode: '', name: '', stock: 0, minStock: 5 });
      showNotification('새 제품이 추가되었습니다.');
    } catch (error) {
      showNotification('제품 추가 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 카메라 스캐너 시뮬레이션
  const toggleScanner = () => {
    setScanning(!scanning);
    if (!scanning) {
      setTimeout(() => {
        if (products.length > 0) {
          const randomBarcode = products[Math.floor(Math.random() * products.length)].barcode;
          setBarcodeInput(randomBarcode);
          showNotification('바코드가 스캔되었습니다!');
        }
        setScanning(false);
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-800">브라우저 재고 관리</h1>
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              )}
            </div>
            
            {/* 저장 상태 표시 */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-green-600">
                <Database className="h-4 w-4" />
                <span className="text-sm">브라우저에 저장됨</span>
              </div>
              <button
                onClick={() => storage.exportData()}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                데이터 백업
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 안내 메시지 */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-blue-700">
            💾 <strong>자동 저장:</strong> 모든 데이터가 이 브라우저에 자동으로 저장됩니다. 
            다른 컴퓨터에서도 사용하려면 "데이터 백업" 버튼을 클릭하세요!
          </p>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <nav className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex space-x-8">
            {[
              { id: 'stock', label: '재고 현황', icon: Package },
              { id: 'outbound', label: '출고 관리', icon: ArrowUp },
              { id: 'inbound', label: '입고 관리', icon: ArrowDown },
              { id: 'products', label: '제품 관리', icon: Plus },
              { id: 'history', label: '입출고 이력', icon: Search }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* 메인 컨텐츠 */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        
        {/* 재고 현황 탭 */}
        {activeTab === 'stock' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">전체 재고 현황</h2>
              <div className="text-sm text-gray-500">
                브라우저 저장 • 총 {products.length}개 제품
              </div>
            </div>
            
            <div className="grid gap-4">
              {products.map(product => (
                <div key={product.id} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-gray-900">{product.name}</h3>
                      <p className="text-sm text-gray-500">바코드: {product.barcode}</p>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${
                        product.stock <= product.minStock ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {product.stock}개
                      </div>
                      {product.stock <= product.minStock && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded animate-pulse">
                          재고 부족
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 출고 관리 탭 */}
        {activeTab === 'outbound' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800">출고 관리</h2>
            
            {/* 바코드 스캔 영역 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-medium mb-4">바코드 스캔</h3>
              <div className="flex gap-4 items-center">
                <div className="flex-1">
                  <input
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleBarcodeScan(barcodeInput);
                      }
                    }}
                    placeholder="바코드를 입력하거나 스캔하세요"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={toggleScanner}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    scanning 
                      ? 'bg-red-600 text-white' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Scan className="h-4 w-4" />
                  {scanning ? '스캔 중...' : '카메라 스캔'}
                </button>
                <button
                  onClick={() => handleBarcodeScan(barcodeInput)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  검색
                </button>
              </div>
              {scanning && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg text-center">
                  <div className="animate-pulse">📱 데모용 자동 스캔 중...</div>
                </div>
              )}
            </div>

            {/* 오늘 출고 목록 */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">오늘 출고 예정 목록</h3>
                  {dailyOutbound.length > 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          storage.updateDailyOutbound([]);
                          setDailyOutbound([]);
                        }}
                        className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 flex items-center gap-1"
                      >
                        <Trash2 className="h-3 w-3" />
                        목록 초기화
                      </button>
                      <button
                        onClick={processOutbound}
                        disabled={loading}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
                      >
                        <ArrowUp className="h-4 w-4" />
                        출고 처리
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-6">
                {dailyOutbound.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">바코드를 스캔하여 출고할 제품을 추가하세요</p>
                ) : (
                  <div className="space-y-4">
                    {dailyOutbound.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                        <div>
                          <h4 className="font-medium">{item.name}</h4>
                          <p className="text-sm text-gray-500">현재 재고: {item.stock}개</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => adjustOutboundQuantity(item.id, -1)}
                            className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="text-xl font-bold min-w-[3rem] text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => adjustOutboundQuantity(item.id, 1)}
                            disabled={item.quantity >= item.stock}
                            className="p-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 입고 관리 탭 */}
        {activeTab === 'inbound' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800">입고 관리</h2>
            
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-medium mb-4">입고 등록</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    제품 검색 (제품명 또는 바코드)
                  </label>
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    onFocus={() => setShowProductList(filteredProducts.length > 0)}
                    placeholder="제품명 또는 바코드를 입력하세요"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  
                  {/* 검색 결과 드롭다운 */}
                  {showProductList && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredProducts.map(product => (
                        <button
                          key={product.id}
                          onClick={() => selectProduct(product)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 focus:bg-blue-50 focus:outline-none"
                        >
                          <div className="font-medium text-gray-900">{product.name}</div>
                          <div className="text-sm text-gray-500">
                            바코드: {product.barcode} | 현재 재고: {product.stock}개
                          </div>
                        </button>
                      ))}
                      {filteredProducts.length === 0 && productSearch && (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          검색 결과가 없습니다.
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    입고 수량
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={inboundData.quantity}
                    onChange={(e) => setInboundData({...inboundData, quantity: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    입고 날짜
                  </label>
                  <input
                    type="date"
                    value={inboundData.date}
                    onChange={(e) => setInboundData({...inboundData, date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="flex items-end">
                  <button
                    onClick={processInbound}
                    disabled={loading}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    입고 처리
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 제품 관리 탭 */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800">제품 관리</h2>
            
            {/* 새 제품 추가 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-medium mb-4">새 제품 추가</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    바코드
                  </label>
                  <input
                    type="text"
                    value={newProduct.barcode}
                    onChange={(e) => setNewProduct({...newProduct, barcode: e.target.value})}
                    placeholder="바코드 입력"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    제품명
                  </label>
                  <input
                    type="text"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                    placeholder="제품명 입력"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    초기 재고
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({...newProduct, stock: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    최소 재고
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newProduct.minStock}
                    onChange={(e) => setNewProduct({...newProduct, minStock: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="flex items-end">
                  <button
                    onClick={addNewProduct}
                    disabled={loading}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    제품 추가
                  </button>
                </div>
              </div>
            </div>

            {/* 제품 목록 */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">등록된 제품 목록</h3>
                  <button
                    onClick={() => {
                      if (storage.clearAllData()) {
                        loadData();
                        showNotification('모든 데이터가 초기화되었습니다.');
                      }
                    }}
                    className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    전체 초기화
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        바코드
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        제품명
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        현재 재고
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        최소 재고
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        상태
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {products.map(product => (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                          {product.barcode}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product.stock}개
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product.minStock}개
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {product.stock <= product.minStock ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                              재고 부족
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              정상
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 입출고 이력 탭 */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800">입출고 이력</h2>
            
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">거래 내역</h3>
                  <div className="text-sm text-gray-500">
                    브라우저 저장 • 총 {transactions.length}건
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                {transactions.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    아직 거래 내역이 없습니다.
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          날짜/시간
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          제품명
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          구분
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          수량
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {transactions.map(transaction => (
                        <tr key={transaction.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {transaction.date} {transaction.time}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {transaction.productName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              transaction.type === 'IN' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {transaction.type === 'IN' ? '📦 입고' : '📤 출고'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className={transaction.type === 'IN' ? 'text-blue-600' : 'text-red-600'}>
                              {transaction.type === 'IN' ? '+' : '-'}{transaction.quantity}개
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 푸터 */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <div>
              💾 <strong>브라우저 저장 재고 시스템</strong> - 설정 없이 바로 사용 가능!
            </div>
            <div className="flex items-center gap-4">
              <span>
                📊 저장 위치: <span className="text-green-600 font-medium">로컬 브라우저</span>
              </span>
              <span>
                🔄 업그레이드: <span className="text-blue-600 font-medium">언제든 가능</span>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default InventoryManagementApp;
