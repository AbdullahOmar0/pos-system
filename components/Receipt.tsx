import React from 'react';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

interface OrderItem {
  id: string;
  product_name: string;
  product_price: number;
  quantity: number;
}

Font.register({
  family: 'NotoSans',
  src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-400-normal.woff'
});
const receiptStyles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 15,
    fontFamily: 'NotoSans',
  },
  header: {
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'NotoSans',
  },
  subHeader: {
    fontSize: 10,
    marginBottom: 15,
    textAlign: 'center',
    color: '#666',
    fontFamily: 'NotoSans',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    borderBottomStyle: 'dashed',
    marginVertical: 8,
  },
  table: {
    width: '100%',
    marginVertical: 8,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    marginBottom: 4,
    backgroundColor: '#f8f9fa',
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: 'NotoSans',
    flex: 1,
    textAlign: 'right',
  },
  tableCol: {
    flex: 1,
    textAlign: 'right',
    paddingHorizontal: 2,
  },
  tableCell: {
    fontSize: 8,
    padding: 2,
    fontFamily: 'NotoSans',
  },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#000',
    paddingHorizontal: 2,
  },
  totalLabel: {
    fontSize: 10,
    fontFamily: 'NotoSans',
    textAlign: 'right',
  },
  totalValue: {
    fontSize: 10,
    fontFamily: 'NotoSans',
    textAlign: 'right',
  },
  footer: {
    marginTop: 20,
    fontSize: 8,
    textAlign: 'center',
    color: '#666',
    fontFamily: 'NotoSans',
  },
  datetime: {
    fontSize: 8,
    textAlign: 'center',
    marginTop: 10,
    color: '#666',
    fontFamily: 'NotoSans',
  },
  storeName: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
    fontFamily: 'NotoSans',
  },
  storeInfo: {
    fontSize: 8,
    textAlign: 'center',
    color: '#666',
    marginBottom: 10,
    fontFamily: 'NotoSans',
  }
});

interface ReceiptProps {
  order: OrderItem[];
  total: number;
  amountReceived: number;
  change: number;
  currentTime: string;
  currentDate: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('ar-IQ', { style: 'currency', currency: 'IQD' }).format(amount);
};

const Receipt: React.FC<ReceiptProps> = ({ order, total, amountReceived, change, currentTime, currentDate }) => {
  return (
    <Document>
    <Page size="A6" style={receiptStyles.page}>
      <Text style={receiptStyles.storeName}>فرۆشگای من</Text>
      <Text style={receiptStyles.storeInfo}>
        ناونیشان: شەقامی سەرەکی، هەولێر{'\n'}
        تەلەفۆن: ٠٧٥٠ ١٢٣ ٤٥٦٧
      </Text>
      
      <Text style={receiptStyles.header}>پسوڵەی کڕین</Text>
      
      <View style={receiptStyles.divider} />
      
      {/* Table Header */}
      <View style={receiptStyles.tableHeader}>
        <Text style={receiptStyles.tableHeaderCell}>دانە</Text>
        <Text style={receiptStyles.tableHeaderCell}>نرخ</Text>
        <Text style={receiptStyles.tableHeaderCell}>کۆی گشتی</Text>
        <Text style={[receiptStyles.tableHeaderCell]}>بەرهەم</Text>

      </View>

      {/* Table Content */}
      <View style={receiptStyles.table}>
        {order.map((item, index) => (
          <View style={receiptStyles.tableRow} key={index}>
           
            <Text style={[receiptStyles.tableCol, receiptStyles.tableCell]}>
              {item.quantity}
            </Text>
            <Text style={[receiptStyles.tableCol, receiptStyles.tableCell]}>
              {formatCurrency(item.product_price)}
            </Text>
            <Text style={[receiptStyles.tableCol, receiptStyles.tableCell]}>
              {formatCurrency(item.product_price * item.quantity)}
            </Text>
            <Text style={[receiptStyles.tableCol, receiptStyles.tableCell]}>
              {item.product_name}
            </Text>
          </View>
        ))}
      </View>

      <View style={receiptStyles.divider} />

      {/* Totals */}
      <View style={receiptStyles.total}>
        <Text style={receiptStyles.totalLabel}>کۆی گشتی:</Text>
        <Text style={receiptStyles.totalValue}>{formatCurrency(total)}</Text>
      </View>
      
      <View style={receiptStyles.total}>
        <Text style={receiptStyles.totalLabel}>پارەی دراو:</Text>
        <Text style={receiptStyles.totalValue}>{formatCurrency(amountReceived)}</Text>
      </View>
      
      <View style={receiptStyles.total}>
        <Text style={receiptStyles.totalLabel}>گەڕاوە:</Text>
        <Text style={receiptStyles.totalValue}>{formatCurrency(change)}</Text>
      </View>

      <View style={receiptStyles.divider} />

      <Text style={receiptStyles.datetime}>
        {currentDate} - {currentTime}
      </Text>

      <Text style={receiptStyles.footer}>
        سوپاس بۆ کڕینەکەت{'\n'}
        بەخێربێیتەوە
      </Text>
    </Page>
  </Document>
  );
};

export default Receipt;