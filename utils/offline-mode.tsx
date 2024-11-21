import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/useTranslation';

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

// Wir erstellen einen Übersetzungskontext außerhalb der Komponente
let translationFunction: typeof useTranslation extends () => { t: infer T } ? T : never = (key) => key;

export function OfflineMode() {
  const { t } = useTranslation();
  
  // Aktualisiere die globale Übersetzungsfunktion
  useEffect(() => {
    translationFunction = t;
  }, [t]);

  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)
  const supabase = createClient()

  const showOfflineToast = useCallback(() => {
    toast.error(t('notifications.offline.title'), {
      description: t('notifications.offline.description'),
      duration: 5000,
    })
  }, [t])

  const showOnlineToast = useCallback(() => {
    toast.success(t('notifications.online.title'), {
      description: t('notifications.online.description'),
      duration: 5000,
    })
  }, [t])

  const showSyncingToast = useCallback(() => {
    toast.info(t('notifications.syncing.title'), {
      description: t('notifications.syncing.description'),
      duration: 5000,
    })
  }, [t])

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
      toast.error(t('notifications.dbError.title'), {
        description: t('notifications.dbError.description'),
        duration: 5000,
      })
    }
  }, [t])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      showOnlineToast()
      syncOfflineTransactions()
    }
    const handleOffline = () => {
      setIsOnline(false)
      showOfflineToast()
    }

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
  }, [initIndexedDB, showOnlineToast, showOfflineToast])

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
      toast.error('Sync Error', {
        description: 'Failed to sync products to offline database.',
        duration: 5000,
      })
    }
  }

  const syncOfflineTransactions = async () => {
    if (!db || !navigator.onLine) return

    setIsSyncing(true)
    showSyncingToast()
    console.log('Starting offline transaction synchronization')

    try {
      const offlineTransactions = await db.getAll('offlineTransactions')
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

          await db.delete('offlineTransactions', transaction.id)
          console.log("Offline transaction synced and deleted successfully:", transaction.id)
        } catch (error) {
          console.error("Error syncing offline transaction:", error)
        }
      }

      console.log('Offline transaction synchronization completed')
      toast.success(t('notifications.syncing.completed'), {
        description: t('notifications.syncing.completedDescription'),
        duration: 5000,
      })
    } catch (error) {
      console.error("Error during offline transaction synchronization:", error)
      toast.error('Sync Error', {
        description: 'Failed to synchronize some offline transactions.',
        duration: 5000,
      })
    } finally {
      setIsSyncing(false)
    }
  }

  return null
}

export const addOfflineTransaction = async (transaction: OfflineTransaction) => {
  if (!db) {
    console.error("IndexedDB is not initialized");
    return;
  }

  try {
    await db.add('offlineTransactions', transaction);
    console.log("Offline transaction added successfully:", transaction.id);
    toast.success(translationFunction('pos.batchPayment.offlineTransactionSaved'), {
      description: translationFunction('notifications.offline.description'),
      duration: 3000,
    })
  } catch (error) {
    console.error("Error adding offline transaction:", error);
    toast.error(translationFunction('pos.batchPayment.offlineSaveError'), {
      description: translationFunction('notifications.dbError.description'),
      duration: 5000,
    })
  }
}

export const getProductFromIndexedDB = async (productId: string) => {
  if (!db) return null

  try {
    return await db.get('products', productId)
  } catch (error) {
    console.error(`Error getting product ${productId} from IndexedDB:`, error)
    toast.error('Product Fetch Error', {
      description: `Failed to fetch product ${productId} from offline database.`,
      duration: 5000,
    })
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
      toast.error('Stock Update Error', {
        description: `Product ${productId} not found in offline database.`,
        duration: 5000,
      })
    }
  } catch (error) {
    console.error(`Error updating stock for product ${productId}:`, error);
    toast.error('Stock Update Error', {
      description: `Failed to update stock for product ${productId} in offline database.`,
      duration: 5000,
    })
  }
}