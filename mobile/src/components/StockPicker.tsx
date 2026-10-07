import { useState } from 'react'
import { FlatList, Modal, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { availableStock, receiptCapacity, type StockReceipt } from '../registration'
import { Button, Field, colors, styles } from '../ui'
import { matchesWordPrefix } from '../search'

export function StockPicker({ kind, receipts, selected, installedReceiptId, emptyLabel, onSelect, onClose }: {
  kind: 'RAM' | 'SSD'; receipts: StockReceipt[]; selected: string; onSelect: (id: string) => void; onClose: () => void;
  installedReceiptId?: string | null; emptyLabel?: string;
}) {
  const [search, setSearch] = useState('')
  const insets = useSafeAreaInsets()
  const options = receipts.filter(row => row.category === kind && matchesWordPrefix(search, row.item_name, row.specification, row.reference_number))
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: '#10231CB3', justifyContent: 'center', padding: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}>
      <View style={[styles.card, { maxHeight: '90%', gap: 14 }]}>
        <Text style={styles.heading}>Choose {kind} stock</Text>
        <Field label="Search consumables" placeholder="Item, specification, or reference" value={search} onChangeText={setSearch} autoCapitalize="none" />
        <Button title={emptyLabel || `No ${kind} installed`} secondary onPress={() => onSelect('')} />
        <FlatList data={options} keyExtractor={row => row.id} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}
          ListEmptyComponent={<Text style={styles.small}>No matching stock. Receive consumables in the web system first.</Text>}
          renderItem={({ item }) => {
            const capacity = receiptCapacity(item)
            const available = availableStock(item)
            const disabled = !capacity || (available < 1 && item.id !== installedReceiptId) || item.used_quantity === undefined
            return <Pressable accessibilityRole="button" accessibilityState={{ selected: selected === item.id, disabled }} disabled={disabled} onPress={() => onSelect(item.id)} style={{ padding: 12, gap: 3, borderBottomWidth: 1, borderColor: colors.line, backgroundColor: selected === item.id ? '#EAF3EB' : '#FFF', opacity: disabled ? 0.55 : 1 }}>
              <Text style={styles.text}>{item.item_name}</Text><Text style={styles.small}>{item.specification}</Text>
              <Text style={styles.small}>{capacity ? `${capacity} GB · ` : 'Capacity missing · '}{available} available · {item.date_received}</Text>
              {item.reference_number && <Text style={styles.small}>Ref: {item.reference_number}</Text>}
              {item.used_quantity === undefined && <Text style={styles.small}>Stock linking is not configured.</Text>}
            </Pressable>
          }} />
        <Button title="Close" secondary onPress={onClose} />
      </View>
    </View>
  </Modal>
}
