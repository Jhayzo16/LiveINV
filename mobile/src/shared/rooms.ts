import catalog from './room-catalog.json'

export const hospitalFloors = [
  { id: 1, label: 'Ground Floor' }, { id: 2, label: 'Second Floor' },
  { id: 3, label: 'Third Floor' }, { id: 4, label: 'Fourth Floor' },
  { id: 5, label: 'Fifth Floor' }, { id: 6, label: 'Sixth Floor' }, { id: 7, label: 'Seventh Floor' },
]

// The shape identity is shared by the map and every assignment entry point.
export const hospitalRooms = Object.values(catalog).flatMap(floor => floor.rooms).map(room => ({
  ...room, code: room.name, department: room.name,
}))

export const assignmentLocations = hospitalRooms.map(room => ({
  floor: String(room.floor), roomId: room.id, room: room.name, department: room.department,
  label: hospitalRooms.filter(other => other.floor === room.floor && other.name === room.name).length > 1
    ? `${room.name} (space ${room.id.split('-').at(-1)})` : room.name,
}))
