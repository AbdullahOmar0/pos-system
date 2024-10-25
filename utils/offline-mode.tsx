import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { openDB, DBSchema, IDBPDatabase } from 'idb'

export interface OfflineTransaction {
  id: string
  items: {
    id: string
    product_name: string
    quantity: number
    price: number
    currentStock: number
  }[]
  total: number
  amountReceived: number
  change: number
  timestamp: number
}

interface MyDB extends DBSchema {
  products: {
    key: string
    value: {
      id: string
      product_name: string
      product_price: number
      product_stock: number
    }
  }
  offlineTransactions: {
    key: string
    value: OfflineTransaction
  }
}

let db: IDBPDatabase<MyDB> | null = null

export function OfflineMode() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)
  const supabase = createClient()

  const initIndexedDB = useCallback(async () => {
    try {
      db = await openDB<MyDB>('pos-offline-db', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('products')) {
            db.createObjectStore('products', { keyPath: 'id' })
          }
          if (!db.objectStoreNames.contains('offlineTransactions')) {
            db.createObjectStore('offlineTransactions', { keyPath: 'id' })
          }
        },
      })
      console.log('IndexedDB initialized successfully')
      setDbError(null)
      await syncProductsToIndexedDB()
      if (navigator.onLine) {
        await syncOfflineTransactions()
      }
    } catch (error) {
      console.error('Error initializing IndexedDB:', error)
      setDbError('Failed to initialize offline database. Please refresh the page.')
    }
  }, [])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      syncOfflineTransactions()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    initIndexedDB()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (db) {
        db.close()
        db = null
      }
    }
  }, [initIndexedDB])

  const syncProductsToIndexedDB = async () => {
    if (!db) return

    try {
      const { data: products, error } = await supabase.from('products').select('*')
      if (error) {
        throw error
      }

      const tx = db.transaction('products', 'readwrite')
      for (const product of products) {
        await tx.store.put(product)
      }
      await tx.done
      console.log('Products synced to IndexedDB')
    } catch (error) {
      console.error('Error syncing products to IndexedDB:', error)
    }
  }

  const syncOfflineTransactions = async () => {
    if (!db || !navigator.onLine) return

    setIsSyncing(true)
    console.log('Starting offline transaction synchronization')

    try {
      const tx = db.transaction('offlineTransactions', 'readwrite')
      const offlineTransactions = await tx.store.getAll()

      console.log(`Found ${offlineTransactions.length} offline transactions to sync`)

      for (const transaction of offlineTransactions) {
        try {
          const { data: saleData, error: saleError } = await supabase
            .from('sales')
            .insert({
              sale_date: new Date(transaction.timestamp).toISOString(),
              total_amount: transaction.total,
              amount_received: transaction.amountReceived,
              change: transaction.change,
              user_id: (await supabase.auth.getUser()).data.user?.id
            })
            .select()

          if (saleError) {
            throw saleError
          }

          const saleId = saleData[0].id

          for (const item of transaction.items) {
            const { error: itemError } = await supabase
              .from('sales_items')
              .insert({
                sale_id: saleId,
                product_id: item.id,
                product_name: item.product_name,
                quantity: item.quantity,
                price: item.price
              })

            if (itemError) {
              throw itemError
            }

            const { error: stockError } = await supabase
              .from('products')
              .update({ product_stock: item.currentStock })
              .eq('id', item.id)

            if (stockError) {
              throw stockError
            }
          }

          await tx.store.delete(transaction.id)
          console.log("Offline transaction synced and deleted successfully:", transaction.id)
        } catch (error) {
          console.error("Error syncing offline transaction:", error)
        }
      }

      await tx.done
    } catch (error) {
      console.error("Error during offline transaction synchronization:", error)
    } finally {
      setIsSyncing(false)
      console.log('Offline transaction synchronization completed')
    }
  }

  return (
    <div className="p-4 bg-gray-100 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Offline-Modus</h2>
      {dbError ? (
        <p className="text-red-600">{dbError}</p>
      ) : (
        <>
          <p className="mb-2">
            Status: <span className={isOnline ? "text-green-600" : "text-red-600"}>
              {isOnline ? "Online" : "Offline"}
            </span>
          </p>
          <p className="text-sm text-gray-600">
            {isOnline 
              ? isSyncing
                ? "Synchronisiere offline Transaktionen..."
                : "Alle Transaktionen werden direkt verarbeitet." 
              : "Transaktionen werden lokal gespeichert und bei Wiederherstellung der Verbindung synchronisiert."}
          </p>
        </>
      )}
    </div>
  )
}

export const addOfflineTransaction = async (transaction: OfflineTransaction) => {
  if (!db) {
    console.error("IndexedDB is not initialized");
    return;
  }

  try {
    await db.add('offlineTransactions', transaction);
    console.log("Offline transaction added successfully:", transaction.id);
  } catch (error) {
    console.error("Error adding offline transaction:", error);
  }
}

export const getProductFromIndexedDB = async (productId: string) => {
  if (!db) return null

  try {
    return await db.get('products', productId)
  } catch (error) {
    console.error(`Error getting product ${productId} from IndexedDB:`, error)
    return null
  }
}

export const updateProductStock = async (productId: string, quantityChange: number) => {
  if (!db) {
    console.error("IndexedDB is not initialized");
    return;
  }

  try {
    const tx = db.transaction('products', 'readwrite');
    const product = await tx.store.get(productId);
    if (product) {
      product.product_stock += quantityChange;
      await tx.store.put(product);
      await tx.done;
      console.log(`Updated stock for product ${productId}: new stock ${product.product_stock}`);
    } else {
      console.error(`Product ${productId} not found in IndexedDB`);
    }
  } catch (error) {
    console.error(`Error updating stock for product ${productId}:`, error);
  }
}