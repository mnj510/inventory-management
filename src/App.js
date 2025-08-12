import React, { useState, useEffect } from 'react';
import { Package, Plus, Minus, Scan, Save, Trash2, ArrowUp, ArrowDown, Search, Cloud, CloudOff } from 'lucide-react';

// Supabase 설정
const SUPABASE_URL = "https://gqxyrnftftwokgvvtvdk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxeHlyblR0ZnR3b2tndnR2ZGsiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNTgwNjI3MiwiZXhwIjoyMDUxMzgyMjcyfQ.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxeHlyblR0ZnR3b2tndnR2ZGsiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNTgwNjI3MiwiZXhwIjoyMDUxMzgyMjcyfQ";

// Supabase 클라이언트 클래스 (라이브러리 없이 직접 구현)
class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
    this.listeners = new Map();
  }

  // HTTP 요청 헬퍼
  async request(endpoint, options = {}) {
    const url = `${this.url}/rest/v1/${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'apikey': this.key,
      'Authorization': `Bearer ${this.key}`,
      'Prefer': 'return=representation',
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      console.error('Supabase request error:', error);
      return { data: null, error: error.message };
    }
  }

  // 테이블 선택
  from(table) {
    return new SupabaseTable(this, table);
  }

  // 실시간 구독 시뮬레이션 (실제로는 더 복잡함)
  subscribe(callback) {
    const intervalId = setInterval(async () => {
      try {
        const { data: products } = await this.from('products').select('*');
        const { data: transactions } = await this.from('transactions').select('*').order('created_at', { ascending: false });
        const { data: dailyOutbound } = await this.from('daily_outbound').select('*');
        
        callback({
          products: products || [],
          transactions: transactions || [],
          dailyOutbound: dailyOutbound || []
        });
      } catch (error) {
        console.error('Subscription error:', error);
      }
    }, 2000); // 2초마다 폴링

    return () => clearInterval(intervalId);
  }
}

class SupabaseTable {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.query = {
      select: '*',
      filters: [],
      orderBy: null,
      limit: null
    };
  }

  select(columns = '*') {
    this.query.select = columns;
    return this;
  }

  eq(column, value) {
    this.query.filters.push(`${column}=eq.${value}`);
    return this;
  }

  order(column, options = {}) {
    const direction = options.ascending === false ? 'desc' : 'asc';
    this.query.orderBy = `${column}.${direction}`;
    return this;
  }

  limit(count) {
    this.query.limit = count;
    return this;
  }

  // 조회 실행
  async exec() {
    let endpoint = `${this.table}?select=${this.query.select}`;
    
    if (this.query.filters.length > 0) {
      endpoint += `&${this.query.filters.join('&')}`;
    }
    
    if (this.query.orderBy) {
      endpoint += `&order=${this.query.orderBy}`;
    }
    
    if (this.query.limit) {
      endpoint += `&limit=${this.query.limit}`;
    }

    return await this.client.request(endpoint);
  }

  // 삽입
  async insert(data) {
    const isArray = Array.isArray(data);
    return await this.client.request(this.table, {
      method: 'POST',
      body: JSON.stringify(isArray ? data : [data])
    });
  }

  // 업데이트
  async update(data) {
    let endpoint = this.table;
    if (this.query.filters.length > 0) {
      endpoint += `?${this.query.filters.join('&')}`;
    }
    
    return await this.client.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  // 삭제
  async delete() {
    let endpoint = this.table;
    if (this.query.filters.length > 0) {
      endpoint += `?${this.query.filters.join('&')}`;
    }
    
    return await this.client.request(endpoint, {
      method: 'DELETE'
    });
  }
}

// Supabase 클라이언트 인스턴스
const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const InventoryManagementApp = () => {
  // 상태 관리
  const [activeTab, setActiveTab] = useState('stock');
  const [products, setProducts] = useState([]);
  const [dailyOutbound, setDailyOutbound] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState(new Date());
  
  const [barcodeInput, setBarcodeInput] = useState('');
  const [newProduct, setNewProduct] = useState({ barcode: '', name: '', stock: 0, minStock: 5 });
  const [inboundData, setInboundData] = useState({ productId: '', quantity: 1, date: new Date().toISOString().split('T')[0] });
  const [productSearch, setProductSearch] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [showProductList, setShowProductList] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Supabase 실시간 구독
  useEffect(() => {
    const unsubscribe = supabase.subscribe((data) => {
      setProducts(data.products);
      setTransactions(data.transactions);
      setDailyOutbound(data.dailyOutbound);
      setLastSync(new Date());
      setConnected(true);
    });

    return unsubscribe;
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

  // 에러 처리 헬퍼
  const handleAsync = async (asyncFn, successMessage) => {
    try {
      setLoading(true);
      setConnected(true);
      const result = await asyncFn();
      if (successMessage) {
        showNotification(successMessage, 'success');
      }
      return result;
    } catch (error) {
      setConnected(false);
      showNotification(error.message || '오류가 발생했습니다', 'error');
      throw error;
    } finally {
      setLoading(false);
    }
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
  const handleBarcodeScan = async (barcode) => {
    if (!barcode.trim()) return;
    
    const product = findProductByBarcode(barcode);
    if (product) {
      await addToOutboundList(product);
      setBarcodeInput('');
    } else {
      showNotification(`바코드 ${barcode}에 해당하는 제품을 찾을 수 없습니다.`, 'error');
    }
  };

  // 출고 목록에 추가
  const addToOutboundList = async (product) => {
    await handleAsync(async () => {
      // 기존에 같은 제품이 있는지 확인
      const { data: existing } = await supabase
        .from('daily_outbound')
        .select('*')
        .eq('product_id', product.id);

      if (existing && existing.length > 0) {
        // 기존 제품의 수량 증가
        const { error } = await supabase
          .from('daily_outbound')
          .update({ quantity: existing[0].quantity + 1 })
          .eq('product_id', product.id);
        
        if (error) throw new Error(error);
      } else {
        // 새 제품 추가
        const { error } = await supabase
          .from('daily_outbound')
          .insert({
            product_id: product.id,
            product_name: product.name,
            barcode: product.barcode,
            stock: product.stock,
            min_stock: product.min_stock,
            quantity: 1
          });
        
        if (error) throw new Error(error);
      }
    }, `${product.name}이(가) 출고 목록에 추가되었습니다.`);
  };

  // 출고 목록 수량 조정
  const adjustOutboundQuantity = async (productId, change) => {
    await handleAsync(async () => {
      const currentItem = dailyOutbound.find(item => item.product_id === productId);
      if (!currentItem) return;

      const newQuantity = Math.max(0, currentItem.quantity + change);
      
      if (newQuantity === 0) {
        // 수량이 0이면 삭제
        const { error } = await supabase
          .from('daily_outbound')
          .delete()
          .eq('product_id', productId);
        
        if (error) throw new Error(error);
      } else {
        // 수량 업데이트
        const { error } = await supabase
          .from('daily_outbound')
          .update({ quantity: newQuantity })
          .eq('product_id', productId);
        
        if (error) throw new Error(error);
      }
    });
  };

  // 출고 처리
  const processOutbound = async () => {
    if (dailyOutbound.length === 0) {
      showNotification('출고할 제품이 없습니다.', 'error');
      return;
    }

    await handleAsync(async () => {
      const today = new Date().toISOString().split('T')[0];
      const currentTime = new Date().toLocaleTimeString();

      // 각 제품별 처리
      for (const outboundItem of dailyOutbound) {
        const product = products.find(p => p.id === outboundItem.product_id);
        if (!product) continue;

        // 재고 업데이트
        const newStock = Math.max(0, product.stock - outboundItem.quantity);
        const { error: stockError } = await supabase
          .from('products')
          .update({ 
            stock: newStock,
            updated_at: new Date().toISOString()
          })
          .eq('id', product.id);
        
        if (stockError) throw new Error(stockError);

        // 거래 기록 추가
        const { error: transError } = await supabase
          .from('transactions')
          .insert({
            product_id: product.id,
            product_name: product.name,
            type: 'OUT',
            quantity: outboundItem.quantity,
            date: today,
            time: currentTime
          });
        
        if (transError) throw new Error(transError);
      }

      // 출고 목록 초기화
      const { error: clearError } = await supabase
        .from('daily_outbound')
        .delete()
        .neq('id', 0); // 모든 항목 삭제
      
      if (clearError) throw new Error(clearError);

    }, `${dailyOutbound.length}개 제품이 출고 처리되었습니다.`);
  };

  // 입고 처리
  const processInbound = async () => {
    if (!inboundData.productId || inboundData.quantity <= 0) {
      showNotification('제품과 수량을 정확히 입력해주세요.', 'error');
      return;
    }

    const product = products.find(p => p.id === parseInt(inboundData.productId));
    if (!product) {
      showNotification('제품을 찾을 수 없습니다.', 'error');
      return;
    }

    await handleAsync(async () => {
      // 재고 업데이트
      const newStock = product.stock + parseInt(inboundData.quantity);
      const { error: stockError } = await supabase
        .from('products')
        .update({ 
          stock: newStock,
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id);
      
      if (stockError) throw new Error(stockError);

      // 거래 기록 추가
      const { error: transError } = await supabase
        .from('transactions')
        .insert({
          product_id: product.id,
          product_name: product.name,
          type: 'IN',
          quantity: parseInt(inboundData.quantity),
          date: inboundData.date,
          time: new Date().toLocaleTimeString()
        });
      
      if (transError) throw new Error(transError);

      // 입력 폼 초기화
      setInboundData({ 
        productId: '', 
        quantity: 1, 
        date: new Date().toISOString().split('T')[0] 
      });
      setProductSearch('');

    }, `${product.name} ${inboundData.quantity}개가 입고 처리되었습니다.`);
  };

  // 새 제품 추가
  const addNewProduct = async () => {
    if (!newProduct.barcode || !newProduct.name) {
      showNotification('바코드와 제품명을 입력해주세요.', 'error');
      return;
    }

    if (products.some(p => p.barcode === newProduct.barcode)) {
      showNotification('이미 존재하는 바코드입니다.', 'error');
      return;
    }

    await handleAsync(async () => {
      const { error } = await supabase
        .from('products')
        .insert({
          barcode: newProduct.barcode,
          name: newProduct.name,
          stock: parseInt(newProduct.stock) || 0,
          min_stock: parseInt(newProduct.minStock) || 5
        });
      
      if (error) throw new Error(error);

      setNewProduct({ barcode: '', name: '', stock: 0, minStock: 5 });
    }, '새 제품이 추가되었습니다.');
  };

  // 카메라 스캐너 시뮬레이션
  const toggleScanner = () => {
    if (!connected) {
      showNotification('오프라인 상태에서는 스캔할 수 없습니다.', 'error');
      return;
    }
    
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
              <h1 className="text-2xl font-bold text-gray-800">실시간 재고 관리</h1>
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              )}
            </div>
            
            {/* 연결 상태 표시 */}
            <div className="flex items-center gap-2">
              {connected ? (
                <div className="flex items-center gap-2 text-green-600">
                  <Cloud className="h-4 w-4" />
                  <span className="text-sm">Supabase 연결됨</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600">
                  <CloudOff className="h-4 w-4" />
                  <span className="text-sm">연결 오류</span>
                </div>
              )}
              <span className="text-xs text-gray-500">
                최종 동기화: {lastSync.toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 실시간 공유 알림 */}
      <div className="bg-green-50 border-l-4 border-green-400 p-4">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-green-700">
            🔄 <strong>실시간 공유 활성화!</strong> 모든 기기에서 데이터가 자동으로 동기화됩니다. 
            다른 컴퓨터나 스마트폰에서도 같은 URL로 접속하면 실시간으로 연동됩니다!
          </p>
        </div>
      </div>

      {/* 오프라인 알림 */}
      {!connected && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="max-w-6xl mx-auto px-4">
            <p className="text-red-700">
              ⚠️ Supabase 연결에 문제가 있습니다. 인터넷 연결을 확인해주세요.
            </p>
          </div>
        </div>
      )}

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
                실시간 동기화 • 총 {products.length}개 제품
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
                        product.stock <= product.min_stock ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {product.stock}개
                      </div>
                      {product.stock <= product.min_stock && (
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
                    disabled={!connected}
                  />
                </div>
                <button
                  onClick={toggleScanner}
                  disabled={!connected}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
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
                  disabled={!connected}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <h3 className="font-medium">오늘 출고 예정 목록 (실시간 공유)</h3>
                  {dailyOutbound.length > 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAsync(async () => {
                          const { error } = await supabase
                            .from('daily_outbound')
                            .delete()
                            .neq('id', 0);
                          if (error) throw new Error(error);
                        })}
                        disabled={!connected}
                        className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 flex items-center gap-1 disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                        목록 초기화
                      </button>
                      <button
                        onClick={processOutbound}
                        disabled={!connected}
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
                          <h4 className="font-medium">{item.product_name}</h4>
                          <p className="text-sm text-gray-500">현재 재고: {item.stock}개</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => adjustOutboundQuantity(item.product_id, -1)}
                            disabled={!connected}
                            className="p-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="text-xl font-bold min-w-[3rem] text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => adjustOutboundQuantity(item.product_id, 1)}
                            disabled={!connected || item.quantity >= item.stock}
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
                    disabled={!connected}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
                    disabled={!connected}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
                    disabled={!connected}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                </div>
                
                <div className="flex items-end">
                  <button
                    onClick={processInbound}
                    disabled={!connected}
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
                    disabled={!connected}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
                    disabled={!connected}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
                    disabled={!connected}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
                    disabled={!connected}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                </div>
                
                <div className="flex items-end">
                  <button
                    onClick={addNewProduct}
                    disabled={!connected}
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
                <h3 className="font-medium">등록된 제품 목록 (실시간 동기화)</h3>
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
                          {product.min_stock}개
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {product.stock <= product.min_stock ? (
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
                  <h3 className="font-medium">거래 내역 (실시간 업데이트)</h3>
                  <div className="text-sm text-gray-500">
                    Supabase 동기화 • 총 {transactions.length}건
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
                            {transaction.product_name}
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
              ☁️ <strong>Supabase 실시간 재고 시스템</strong> - 모든 기기에서 실시간 데이터 공유
            </div>
            <div className="flex items-center gap-4">
              <span>
                🌐 URL: <span className="text-blue-600 font-medium">전 세계 접속 가능</span>
              </span>
              <span>
                🔄 동기화: <span className="text-green-600 font-medium">2초마다 자동</span>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default InventoryManagementApp;
