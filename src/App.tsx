import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AssetRepository } from './lib/repositories'
import liveInvLogo from './assets/liveinv-logo.png'
import dashboardIcon from './assets/sidebar/dashboard.png'
import liveMappingIcon from './assets/sidebar/live-mapping.png'
import assetsIcon from './assets/sidebar/assets.png'
import assignmentsIcon from './assets/sidebar/assignments.png'
import qrScannerIcon from './assets/sidebar/qr-scanner.png'
import reportsIcon from './assets/sidebar/reports.png'
import { HospitalBuilding3D } from './components/ui/hospital-building-3d'
import { Toaster } from './components/ui/toast'
import { SystemModulePage, type AssignmentTarget, type SystemModule } from './pages/SystemPages'

type Status = 'Active' | 'Maintenance' | 'Broken'
type Asset = { id: string; name: string; kind: 'Computer' | 'Printer' | 'Monitor'; status: Status; detail: string; ip?: string }
type Room = { id: string; name: string; code: string; department: string; assets: Asset[]; x: number; y: number; w: number; h: number }
type Floor = { id: number; label: string; assets: number }

const floors = [
  { id: 1, label: 'Ground Floor', assets: 78 }, { id: 2, label: 'Second Floor', assets: 112 },
  { id: 3, label: 'Third Floor', assets: 148 }, { id: 4, label: 'Fourth Floor', assets: 96 },
  { id: 5, label: 'Fifth Floor', assets: 131 }, { id: 6, label: 'Sixth Floor', assets: 64 }, { id: 7, label: 'Seventh Floor', assets: 44 },
]

const makeAssets = (floor: number, code: string, count = 3): Asset[] => {
  return []
}

const room = (floor: number, id: string, name: string, code: string, department: string, x: number, y: number, w: number, h: number, assetCount = 3): Room => ({
  id: `f${floor}-${id}`, name, code, department, x, y, w, h, assets: makeAssets(floor, code, assetCount),
})

const featuredRoomsByFloor: Record<number, Room[]> = {
          1: [
    room(1, 'dark_room', 'DARK ROOM', 'DARK ROOM', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'reception___information', 'RECEPTION / INFORMATION', 'RECEPTION / INFORMATION', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'yakap_office', 'YAKAP OFFICE', 'YAKAP OFFICE', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'minor_operating_room', 'MINOR OPERATING ROOM', 'MINOR OPERATING ROOM', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-1', 'Unassigned Room 1', 'UN-1', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-2', 'Unassigned Room 2', 'UN-2', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-3', 'Unassigned Room 3', 'UN-3', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-4', 'Unassigned Room 4', 'UN-4', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-5', 'Unassigned Room 5', 'UN-5', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-6', 'Unassigned Room 6', 'UN-6', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-7', 'Unassigned Room 7', 'UN-7', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-8', 'Unassigned Room 8', 'UN-8', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-9', 'Unassigned Room 9', 'UN-9', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-10', 'Unassigned Room 10', 'UN-10', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-11', 'Unassigned Room 11', 'UN-11', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-12', 'Unassigned Room 12', 'UN-12', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'oecb', 'OECB', 'OECB', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-13', 'Unassigned Room 13', 'UN-13', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-14', 'Unassigned Room 14', 'UN-14', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'nurses_station', 'NURSE\'S STATION', 'NURSE\'S STATION', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'records_rm', 'RECORDS RM.', 'RECORDS RM.', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-15', 'Unassigned Room 15', 'UN-15', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 't_and_b', 'T & B', 'T & B', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'female_doctors_rm', 'FEMALE DOCTORS RM.', 'FEMALE DOCTORS RM.', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'male_doctors_rm', 'MALE DOCTORS RM.', 'MALE DOCTORS RM.', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-16', 'Unassigned Room 16', 'UN-16', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-17', 'Unassigned Room 17', 'UN-17', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'er_admitting_and_satellite_billing', 'E.R. ADMITTING & SATELLITE BILLING', 'E.R. ADMITTING & SATELLITE BILLING', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-18', 'Unassigned Room 18', 'UN-18', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'crisis_intervention_room', 'CRISIS INTERVENTION ROOM', 'CRISIS INTERVENTION ROOM', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-19', 'Unassigned Room 19', 'UN-19', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'doctors_desk', 'DOCTOR\'S DESK', 'DOCTOR\'S DESK', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-20', 'Unassigned Room 20', 'UN-20', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-21', 'Unassigned Room 21', 'UN-21', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-22', 'Unassigned Room 22', 'UN-22', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'er_reception', 'E.R. RECEPTION', 'E.R. RECEPTION', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'radiologist_work_rm', 'RADIOLOGIST WORK RM.', 'RADIOLOGIST WORK RM.', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'x-ray_1', 'X-RAY 1', 'X-RAY 1', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-23', 'Unassigned Room 23', 'UN-23', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'x-ray_2', 'X-RAY 2', 'X-RAY 2', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'ante_rm', 'ANTE RM.', 'ANTE RM.', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'ultrasound_2', 'ULTRASOUND 2', 'ULTRASOUND 2', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'ultrasound_1', 'ULTRASOUND 1', 'ULTRASOUND 1', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'ultrasound_reading', 'ULTRASOUND READING', 'ULTRASOUND READING', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'film_storage', 'FILM STORAGE', 'FILM STORAGE', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'mammography', 'MAMMOGRAPHY', 'MAMMOGRAPHY', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'reading_room', 'READING ROOM', 'READING ROOM', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'rad_tech_office', 'RAD. TECH OFFICE', 'RAD. TECH OFFICE', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'reception_1', 'RECEPTION (RADIOLOGY)', 'RECEPTION (RADIOLOGY)', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-24', 'Unassigned Room 24', 'UN-24', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'cashier', 'CASHIER', 'CASHIER', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'billing', 'BILLING', 'BILLING', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'admitting', 'ADMITTING', 'ADMITTING', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-25', 'Unassigned Room 25', 'UN-25', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'social_services', 'SOCIAL SERVICES', 'SOCIAL SERVICES', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-26', 'Unassigned Room 26', 'UN-26', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'admin_office', 'ADMIN OFFICE', 'ADMIN OFFICE', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'hr_office', 'HR OFFICE', 'HR OFFICE', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 's_to', 'S. TO.', 'S. TO.', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'dangr_drugs', 'DANGR. DRUGS', 'DANGR. DRUGS', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'blood_supply_room', 'BLOOD SUPPLY ROOM', 'BLOOD SUPPLY ROOM', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'laboratory_equipment_area', 'LABORATORY EQUIPMENT AREA', 'LABORATORY EQUIPMENT AREA', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'cutting_and_processing', 'CUTTING & PROCESSING', 'CUTTING & PROCESSING', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'cytology_staining', 'CYTOLOGY/STAINING', 'CYTOLOGY/STAINING', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'cytogenetics', 'CYTOGENETICS', 'CYTOGENETICS', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'sterilization', 'STERILIZATION', 'STERILIZATION', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'microbiology', 'MICROBIOLOGY', 'MICROBIOLOGY', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'media_prep', 'MEDIA PREP.', 'MEDIA PREP.', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'autoclave', 'AUTOCLAVE', 'AUTOCLAVE', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'clinical_microscopy', 'CLINICAL MICROSCOPY', 'CLINICAL MICROSCOPY', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'chief_med_tech', 'CHIEF MED. TECH.', 'CHIEF MED. TECH.', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'blood_extraction', 'BLOOD EXTRACTION', 'BLOOD EXTRACTION', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'reception_2', 'RECEPTION (LABORATORY)', 'RECEPTION (LABORATORY)', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'counseling_and_meeting_room', 'COUNSELING & MEETING ROOM', 'COUNSELING & MEETING ROOM', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-27', 'Unassigned Room 27', 'UN-27', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'un-28', 'Unassigned Room 28', 'UN-28', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'compounding_area', 'COMPOUNDING AREA', 'COMPOUNDING AREA', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'pharmacist', 'PHARMACIST', 'PHARMACIST', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'delivery_apron', 'DELIVERY APRON', 'DELIVERY APRON', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'pharmacy', 'PHARMACY', 'PHARMACY', '1st Floor Dept', 25, 25, 0, 0, 0),
    room(1, 'pathologists_office', 'PATHOLOGISTS\' OFFICE', 'PATHOLOGISTS\' OFFICE', '1st Floor Dept', 25, 25, 0, 0, 0),
  ],
  2: [
    room(2, 'cs_delivery_room', 'CS DELIVERY ROOM', 'CS DELIVERY ROOM', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'd.r_sub-sterilization', 'D.R SUB-STERILIZATION', 'D.R SUB-STERILIZATION', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'd.r._supply', 'D.R. SUPPLY', 'D.R. SUPPLY', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'delivery_room_1', 'DELIVERY ROOM 1', 'DELIVERY ROOM 1', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'delivery_room_2', 'DELIVERY ROOM 2', 'DELIVERY ROOM 2', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'clean_up', 'CLEAN UP', 'CLEAN UP', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'lounge', 'LOUNGE', 'LOUNGE', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'treatment_infant_washing', 'TREATMENT INFANT WASHING', 'TREATMENT INFANT WASHING', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'supply_room', 'SUPPLY ROOM', 'SUPPLY ROOM', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'nicu', 'NICU', 'NICU', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'un-10', 'Unassigned Room 1', 'UN-10', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'outborn', 'OUTBORN', 'OUTBORN', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'newborn_care_area', 'NEWBORN CARE AREA', 'NEWBORN CARE AREA', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'un-13', 'Unassigned Room 2', 'UN-13', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'un-14', 'Unassigned Room 3', 'UN-14', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'un-15', 'Unassigned Room 4', 'UN-15', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'nurses_station_nicu', 'NURSE\'S STATION NICU', 'NURSE\'S STATION NICU', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'un-17', 'Unassigned Room 5', 'UN-17', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'un-18', 'Unassigned Room 6', 'UN-18', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'un-19', 'Unassigned Room 7', 'UN-19', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'or/dr_transfer_room', 'OR/DR TRANSFER ROOM', 'OR/DR TRANSFER ROOM', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'labor_room', 'LABOR ROOM', 'LABOR ROOM', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'dr_nurses_station_2', 'DR NURSE\'S STATION 2', 'DR NURSE\'S STATION 2', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'major_or_5', 'MAJOR OR 5', 'MAJOR OR 5', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'un-24', 'Unassigned Room 8', 'UN-24', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'un-25', 'Unassigned Room 9', 'UN-25', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'un-26', 'Unassigned Room 10', 'UN-26', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'un-27', 'Unassigned Room 11', 'UN-27', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'major_or_4', 'MAJOR OR 4', 'MAJOR OR 4', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'major_or_3', 'MAJOR OR 3', 'MAJOR OR 3', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'or_sub-sterilization', 'OR SUB-STERILIZATION', 'OR SUB-STERILIZATION', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'major_or_2', 'MAJOR OR 2', 'MAJOR OR 2', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'major_or_1', 'MAJOR OR 1', 'MAJOR OR 1', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'un-33', 'Unassigned Room 12', 'UN-33', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'un-34', 'Unassigned Room 13', 'UN-34', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'un-35', 'Unassigned Room 14', 'UN-35', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'meeting_room', 'MEETING ROOM', 'MEETING ROOM', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'labor_pre_assessment_rm', 'LABOR PRE ASSESSMENT RM', 'LABOR PRE ASSESSMENT RM', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'nurses_reception', 'NURSE\'S RECEPTION', 'NURSE\'S RECEPTION', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'recovery_room', 'RECOVERY ROOM', 'RECOVERY ROOM', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'dr_nurses_station_1', 'DR NURSE\'S STATION 1', 'DR NURSE\'S STATION 1', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'or_waiting_area', 'OR WAITING AREA', 'OR WAITING AREA', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'un-42', 'Unassigned Room 15', 'UN-42', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'recep.', 'RECEP.', 'RECEP.', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'consult._rm', 'CONSULT. RM', 'CONSULT. RM', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'custodian_area_cssr', 'CUSTODIAN AREA CSSR', 'CUSTODIAN AREA CSSR', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'picu_4', 'PICU 4', 'PICU 4', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'picu_3', 'PICU 3', 'PICU 3', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'picu_2', 'PICU 2 (W/ PROV. FOR DIALYSIS)', 'PICU 2', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'picu_1', 'PICU 1 (W/ PROV. FOR DIALYSIS)', 'PICU 1', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'picu_isolation', 'PICU ISOLATION (SEPTIC)', 'PICU ISOLATION', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'treatment_rm', 'TREATMENT RM', 'TREATMENT RM', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'sorting_&_cleaning', 'SORTING & CLEANING', 'SORTING & CLEANING', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'sterile_supply_sto_room', 'STERILE SUPPLY STO ROOM', 'STERILE SUPPLY STO ROOM', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'micu_nurses_station', 'MICU NURSE\'S STATION', 'MICU NURSE\'S STATION', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'picu_nurses_station', 'PICU NURSE\'S STATION', 'PICU NURSE\'S STATION', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'aux_utility', 'AUX UTILITY', 'AUX UTILITY', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'transaction_rm', 'TRANSACTION RM', 'TRANSACTION RM', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'eeme_rm', 'EEME RM', 'EEME RM', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'autoclave', 'AUTOCLAVE', 'AUTOCLAVE', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'general_supply_sto_room', 'GENERAL SUPPLY STO ROOM', 'GENERAL SUPPLY STO ROOM', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'micu_5', 'MICU 5', 'MICU 5', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'micu_4_acute_stroke_unit', 'MICU 4 ACUTE STROKE UNIT', 'MICU 4 ACUTE STROKE UNIT', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'micu_3', 'MICU 3 (W/ PROV. FOR DIALYSIS)', 'MICU 3', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'micu_2', 'MICU 2 (W/ PROV. FOR DIALYSIS)', 'MICU 2', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'micu_1', 'MICU 1 (W/ PROV. FOR DIALYSIS)', 'MICU 1', '2nd Floor Dept', 25, 25, 10, 2, 1),
    room(2, 'micu_isolation', 'MICU ISOLATION', 'MICU ISOLATION', '2nd Floor Dept', 25, 25, 10, 2, 1),
  ],
  3: [
    room(3, 'dietary', 'Dietary and Canteen', 'DCT', 'Food and Nutrition', 27, 7, 45, 25, 3),
    room(3, 'endoscopy', 'Endoscopy Center', 'END', 'Diagnostics Department', 25, 36, 31, 24, 4),
    room(3, 'business', 'Business Office', 'BUS', 'Administration', 70, 10, 23, 28, 3),
    room(3, 'hemodialysis', 'Hemodialysis Center', 'HDC', 'Renal Services', 48, 65, 45, 25, 4),
  ],
  4: [
    room(4, 'ent', 'ENT and Ophthalmology', 'ENT', 'Outpatient Clinics', 69, 17, 24, 17, 3),
    room(4, 'doctors', 'Doctors Clinics', 'DOC', 'Outpatient Clinics', 22, 18, 50, 20, 4),
    room(4, 'dental', 'Dental Clinic', 'DEN', 'Dental Services', 46, 38, 30, 19, 3),
    room(4, 'infertility', 'Infertility Center', 'IFC', 'Specialty Services', 65, 47, 24, 18, 3),
  ],
  5: [
    room(5, 'multipurpose', 'Multi-Purpose Hall', 'MPH', 'Administration', 20, 34, 33, 25, 2),
    room(5, 'records', 'Medical Records', 'MRR', 'Medical Records Department', 52, 36, 29, 22, 4),
    room(5, 'accounting', 'Accounting Office', 'ACC', 'Finance Department', 53, 14, 23, 16, 3),
    room(5, 'boardroom', 'Boardroom', 'BRD', 'Executive Offices', 74, 13, 18, 17, 3),
  ],
  6: [
    room(6, 'private-north', 'North Private Rooms', 'NPR', 'Inpatient Services', 25, 10, 64, 18, 4),
    room(6, 'surgical-ward', 'Surgical Wards', 'SWD', 'Surgical Services', 25, 31, 51, 25, 4),
    room(6, 'pedia', 'Pediatric Ward', 'PED', 'Women and Children', 58, 49, 27, 17, 3),
    room(6, 'private-south', 'South Private Rooms', 'SPR', 'Inpatient Services', 27, 63, 62, 20, 4),
  ],
  7: [
    room(7, 'private-north', 'North Private Rooms', 'NPR', 'Inpatient Services', 25, 10, 64, 18, 4),
    room(7, 'semi-private', 'Semi-Private Rooms', 'SEM', 'Inpatient Services', 34, 31, 51, 25, 4),
    room(7, 'prayer', 'Prayer Rooms', 'PRY', 'Patient Support', 75, 35, 16, 16, 2),
    room(7, 'private-south', 'South Private Rooms', 'SPR', 'Inpatient Services', 27, 64, 62, 20, 4),
  ],
}

const floorRoomCounts: Record<number, number> = { 1: 81, 2: 67, 3: 55, 4: 40, 5: 38, 6: 37, 7: 37 }

const roomsByFloor: Record<number, Room[]> = Object.fromEntries(floors.map(floorItem => {
  const featured = featuredRoomsByFloor[floorItem.id] ?? []
  const rooms = Array.from({ length: floorRoomCounts[floorItem.id] }, (_, index) => featured[index] ?? room(
    floorItem.id,
    `room-${index + 1}`,
    `Room ${String(index + 1).padStart(2, '0')}`,
    `F${floorItem.id}-R${String(index + 1).padStart(2, '0')}`,
    floorItem.label,
    0, 0, 0, 0, 0,
  ))
  return [floorItem.id, rooms]
}))

const allRooms = Object.values(roomsByFloor).flat()

const floorMapAspectRatios: Record<number, string> = {
  1: '3615 / 3247',
  2: '3547 / 3247',
  3: '3547 / 3247',
  4: '3547 / 3247',
  5: '3547 / 3247',
  6: '3547 / 3247',
  7: '3547 / 3247',
}

const Icon = ({ name, src }: { name?: string; src?: string }) => (
  <span className="icon" aria-hidden="true">
    {src ? <span className="sidebar-icon-mask" style={{ WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` }} /> : name}
  </span>
)
const statusClass = (status: Status) => status.toLowerCase()
const computerCount = (roomItem: Room) => roomItem.assets.filter(assetItem => assetItem.kind === 'Computer').length

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [module, setModule] = useState<SystemModule | 'topology'>('topology')
  const [assignmentTarget, setAssignmentTarget] = useState<AssignmentTarget | null>(null)
  const [floor, setFloor] = useState<number | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [assetId, setAssetId] = useState<string | null>(null)
  const { data: inventoryAssets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: () => AssetRepository.getAll(),
  })

  const dynamicRoomsByFloor = useMemo(() => {
    const map: Record<number, Room[]> = {}
    for (const [floorId, rList] of Object.entries(roomsByFloor)) {
      map[Number(floorId)] = rList.map(r => {
        const roomLocationStr = `F${r.floor} · ${r.name}`
        const assignedAssets = inventoryAssets.filter(a => a.location === roomLocationStr)
        const assets: Asset[] = assignedAssets.map(a => ({
          id: a.qrId || a.tag,
          name: a.name,
          status: a.state.toLowerCase() as Status,
          kind: a.category === 'System Unit' || a.category === 'Laptop' || a.category === 'Server' ? 'Computer' : a.category,
          detail: `${a.brand ?? ''} ${a.model ?? ''}`.trim() || 'Generic Device',
          ip: a.ip || undefined
        }))
        return { ...r, assets }
      })
    }
    return map
  }, [inventoryAssets])

  const dynamicAllRooms = useMemo(() => Object.values(dynamicRoomsByFloor).flat(), [dynamicRoomsByFloor])

  const room = dynamicAllRooms.find(r => r.id === roomId)
  const asset = room?.assets.find(a => a.id === assetId)
  const selectedFloor = floor ? floors.find(item => item.id === floor) : null
  const currentAssets = useMemo(() => dynamicAllRooms.flatMap(item => item.assets), [dynamicAllRooms])

  const total = inventoryAssets.length
  const active = inventoryAssets.filter(a => a.state === 'Active').length
  const maintenance = inventoryAssets.filter(a => a.state === 'Maintenance').length
  const broken = inventoryAssets.filter(a => a.state === 'Broken').length
  const recentAssets = inventoryAssets.slice(0, 3)

  const resetToFloors = () => { setFloor(null); setRoomId(null); setAssetId(null) }
  const openModule = (next: SystemModule | 'topology') => { if (next !== 'assignments') setAssignmentTarget(null); setModule(next); resetToFloors(); window.scrollTo({ top: 0, behavior: 'auto' }) }
  const openRoomAssignment = (targetFloor: number, targetRoom: Room) => {
    setAssignmentTarget({ floor: String(targetFloor), room: targetRoom.name, department: targetRoom.department })
    setModule('assignments')
    resetToFloors()
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  return <div className={`app-shell module-${module} ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
    <LiveInvSidebar module={module} expanded={sidebarOpen} onToggle={() => setSidebarOpen(open => !open)} onNavigate={openModule} totalAssets={total} />
    <main>
      <header className="topbar"><div className="crumbs">{module === 'topology' ? <><button onClick={resetToFloors}>Live Mapping</button>{selectedFloor && <><span>/</span><button onClick={() => { setRoomId(null); setAssetId(null) }}>Floor {floor}</button></>}{room && <><span>/</span><button onClick={() => setAssetId(null)}>{room.name}</button></>}{asset && <><span>/</span><b>{asset.id}</b></>}</> : <><span>Hospital Inventory</span><span>/</span><b>{module === 'qr' ? 'QR Scanner' : module === 'network' ? 'Network Registry' : module === 'manual' ? 'System Manual' : module.charAt(0).toUpperCase() + module.slice(1)}</b></>}</div><div className="top-actions"><button className="ghost-btn">⌕ Search</button><button className="bell">◌</button><span className="avatar">AD</span></div></header>
      {module !== 'topology' && <SystemModulePage module={module} assignmentTarget={assignmentTarget} />}
      {module === 'topology' && !floor && <FloorTopology floors={floors} onSelect={setFloor} />}
      {module === 'topology' && floor && !room && <FloorView floor={selectedFloor!} onBack={resetToFloors} rooms={dynamicRoomsByFloor[floor] ?? []} onAssignEquipment={targetRoom => openRoomAssignment(floor, targetRoom)} />}
      {module === 'topology' && floor && room && !asset && <RoomView room={room} floor={floor} onBack={() => setRoomId(null)} onAsset={setAssetId} onAssignEquipment={() => openRoomAssignment(floor, room)} />}
      {module === 'topology' && floor && room && asset && <AssetView room={room} floor={floor} asset={asset} onBack={() => setAssetId(null)} />}
    </main>
    <aside className="insights-panel"><h3>Live status</h3><p className="muted">Hospital inventory at a glance</p><div className="stat"><span>Total assets</span><b>{total}</b><small>Across 7 floors</small></div><div className="status-list"><StatusRow color="green" label="Active" value={String(active)} /><StatusRow color="amber" label="Maintenance" value={String(maintenance)} /><StatusRow color="red" label="Broken" value={String(broken)} /></div><div className="divider"/><h4>Quick actions</h4><button className="quick primary" onClick={() => openModule('assets')}>＋ Add new asset</button><button className="quick" onClick={() => openModule('qr')}>▣ Scan QR code</button><button className="quick" onClick={() => openModule('assignments')}>⇄ Assign an item</button><div className="recent"><h4>Recently added</h4>{recentAssets.map(item => <button key={item.tag} onClick={() => openModule('assets')}><span className={`dot ${item.state.toLowerCase()}`} />{item.tag}<small>{item.category}</small></button>)}</div></aside>
    <Toaster />
  </div>
}

function LiveInvSidebar({ module, expanded, onToggle, onNavigate, totalAssets = 0 }: {
  module: SystemModule | 'topology'
  expanded: boolean
  onToggle: () => void
  onNavigate: (module: SystemModule | 'topology') => void
  totalAssets?: number
}) {
  const activeNavIndex = ['dashboard', 'topology', 'assets', 'assignments', 'qr', 'reports', 'manual'].indexOf(module)

  const navigate = (next: SystemModule | 'topology') => {
    onNavigate(next)
  }

  return <aside className="sidebar liveinv-sidebar">
    <button className="sidebar-toggle" type="button" onClick={onToggle} aria-label={expanded ? 'Collapse sidebar' : 'Open sidebar'} aria-expanded={expanded}>{expanded ? '‹' : '›'}</button>
    <header className="liveinv-sidebar-header">
      <div className="brand" aria-label="LiveINV">
        <img className="brand-logo" src={liveInvLogo} alt="LiveINV" />
        <span className="brand-wordmark" aria-hidden="true"><span className="brand-live">live</span><span className="brand-inv">INV</span></span>
      </div>
    </header>
    <div className="liveinv-sidebar-body">
      <span className="sidebar-section-label">WORKSPACE</span>
      <nav aria-label="Primary navigation" style={{ '--active-nav-index': activeNavIndex } as CSSProperties}>
        <button className={`nav-item ${module === 'dashboard' ? 'active' : ''}`} onClick={() => navigate('dashboard')}><Icon src={dashboardIcon} /><span className="sidebar-item-label">Dashboard</span></button>
        <button className={`nav-item ${module === 'topology' ? 'active' : ''}`} onClick={() => navigate('topology')}><Icon src={liveMappingIcon} /><span className="sidebar-item-label">Live Mapping</span></button>
        <button className={`nav-item ${module === 'assets' ? 'active' : ''}`} onClick={() => navigate('assets')}><Icon src={assetsIcon} /><span className="sidebar-item-label">Assets</span>{totalAssets > 0 && <span className="nav-count">{totalAssets}</span>}</button>
        <button className={`nav-item ${module === 'assignments' ? 'active' : ''}`} onClick={() => navigate('assignments')}><Icon src={assignmentsIcon} /><span className="sidebar-item-label">Assignments</span></button>
        <button className={`nav-item ${module === 'qr' ? 'active' : ''}`} onClick={() => navigate('qr')}><Icon src={qrScannerIcon} /><span className="sidebar-item-label">QR Scanner</span></button>
        <button className={`nav-item ${module === 'reports' ? 'active' : ''}`} onClick={() => navigate('reports')}><Icon src={reportsIcon} /><span className="sidebar-item-label">Reports</span></button>
        <button className={`nav-item ${module === 'manual' ? 'active' : ''}`} onClick={() => navigate('manual')}><Icon name="?" /><span className="sidebar-item-label">Manual</span></button>
      </nav>
      <div className="sidebar-spacer" />
    </div>
    <footer className="liveinv-sidebar-footer">
      <div className="sidebar-profile-button sidebar-admin-profile" aria-label="Current user: Admin"><span className="avatar">AD</span><span className="sidebar-profile-copy"><b>Admin</b><small>Administrator</small></span></div>
    </footer>
  </aside>
}

function StatusRow({ color, label, value }: { color: string; label: string; value: string }) { return <div className="status-row"><span><i className={color}/>{label}</span><b>{value}</b></div> }

function FloorTopology({ floors, onSelect }: { floors: Floor[]; onSelect:(id:number)=>void }) {
  const modelFloors = floors.map(floorItem => ({ ...floorItem, rooms: floorRoomCounts[floorItem.id] ?? 0 }))
  return <section className="workspace topology-workspace hospital-topology-workspace" aria-label={`${floors.length} hospital floors available`}><div className="section-heading"><span className="eyebrow">VISUAL INVENTORY</span><h1>Hospital topology</h1><p>Rotate the 3D hospital, inspect each floor, and explore its rooms and assigned inventory.</p></div><HospitalBuilding3D floors={modelFloors} onExplore={onSelect} /></section>
}

function FloorView({ floor, onBack, rooms, onAssignEquipment }: { floor:Floor;onBack:()=>void;rooms:Room[];onAssignEquipment:(room:Room)=>void }) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const dragMoved = useRef(false)
  const [directoryOpen, setDirectoryOpen] = useState(false)
  const [figmaRoomNames, setFigmaRoomNames] = useState<Record<string, string>>({})
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null)
  const [hoverCardPosition, setHoverCardPosition] = useState<{ x: number; y: number } | null>(null)
  const [openedRoomId, setOpenedRoomId] = useState<string | null>(null)
  const hoverOpenTimer = useRef<number | null>(null)
  const hoverCloseTimer = useRef<number | null>(null)
  const pendingHoverRoom = useRef<string | null>(null)
  const visibleHoverRoom = useRef<string | null>(null)
  const namedRooms = useMemo(() => rooms.map(item => figmaRoomNames[item.id] ? { ...item, name: figmaRoomNames[item.id] } : item), [figmaRoomNames, rooms])
  const openedRoom = namedRooms.find(item => item.id === openedRoomId)
  const hoveredRoomDetails = namedRooms.find(item => item.id === hoveredRoom)
  const selectedRoom = namedRooms.find(item => item.id === hoveredRoom) ?? openedRoom

  useEffect(() => setFigmaRoomNames({}), [floor.id])

  useEffect(() => () => {
    if (hoverOpenTimer.current) window.clearTimeout(hoverOpenTimer.current)
    if (hoverCloseTimer.current) window.clearTimeout(hoverCloseTimer.current)
  }, [])

  const handleMapHover = (roomId: string | null, point?: { x: number; y: number }) => {
    if (roomId && point) {
      if (hoverCloseTimer.current) {
        window.clearTimeout(hoverCloseTimer.current)
        hoverCloseTimer.current = null
      }
      setHoverCardPosition({
        x: Math.max(12, Math.min(point.x + 16, window.innerWidth - 300)),
        y: Math.max(12, Math.min(point.y + 16, window.innerHeight - 270)),
      })
      if (visibleHoverRoom.current === roomId || pendingHoverRoom.current === roomId) return
      if (hoverOpenTimer.current) window.clearTimeout(hoverOpenTimer.current)
      pendingHoverRoom.current = roomId
      hoverOpenTimer.current = window.setTimeout(() => {
        hoverOpenTimer.current = null
        visibleHoverRoom.current = roomId
        pendingHoverRoom.current = null
        setHoveredRoom(roomId)
      }, 100)
      return
    }

    if (hoverOpenTimer.current) window.clearTimeout(hoverOpenTimer.current)
    hoverOpenTimer.current = null
    pendingHoverRoom.current = null
    if (hoverCloseTimer.current) return
    hoverCloseTimer.current = window.setTimeout(() => {
      hoverCloseTimer.current = null
      visibleHoverRoom.current = null
      setHoveredRoom(null)
      setHoverCardPosition(null)
    }, 100)
  }

  const openRoomDetails = (roomId: string) => {
    if (hoverOpenTimer.current) window.clearTimeout(hoverOpenTimer.current)
    if (hoverCloseTimer.current) window.clearTimeout(hoverCloseTimer.current)
    hoverOpenTimer.current = null
    hoverCloseTimer.current = null
    pendingHoverRoom.current = null
    visibleHoverRoom.current = null
    setHoveredRoom(null)
    setHoverCardPosition(null)
    setOpenedRoomId(roomId)
  }

  return <section className="workspace floor-workspace">
    <div className={`floor-map-layout ${directoryOpen ? '' : 'directory-collapsed'}`}>
      <div className="map-card floor-map-card">
        <div className="map-toolbar">
          <div className="map-toolbar-leading"><button type="button" className="map-toolbar-back" onClick={onBack}>← All floors</button><div><b>{floor.label}</b><span>Floor {floor.id} · {rooms.length} mapped rooms</span></div></div>
          <div className="map-toolbar-actions">
            <button
              type="button"
              className={`directory-toggle ${directoryOpen ? 'is-open' : ''}`}
              aria-controls={`floor-${floor.id}-room-directory`}
              aria-expanded={directoryOpen}
              onClick={() => setDirectoryOpen(open => !open)}
            ><span aria-hidden="true">☷</span>{directoryOpen ? 'Hide directory' : 'Show directory'}</button>
            <div className="zoom-controls"><button onClick={() => setZoom(value => Math.max(.2, value - .2))} aria-label="Zoom out">−</button><button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} aria-label="Reset zoom">{Math.round(zoom * 100)}%</button><button onClick={() => setZoom(value => Math.min(4, value + .2))} aria-label="Zoom in">＋</button></div>
          </div>
        </div>
        <div 
          className="map-viewport"
          style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none', overflow: 'hidden' }}
          onPointerDown={e => {
            if (e.button !== 0 && e.button !== 1) return
            setIsDragging(true)
            dragMoved.current = false
            dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={e => {
            if (!isDragging) return
            const dx = e.clientX - dragStart.current.x
            const dy = e.clientY - dragStart.current.y
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved.current = true
            setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy })
          }}
          onPointerUp={e => {
            setIsDragging(false)
            e.currentTarget.releasePointerCapture(e.pointerId)
          }}
          onWheel={e => {
            if (e.ctrlKey || e.metaKey) {
              setZoom(z => Math.max(0.2, Math.min(4, z - e.deltaY * 0.005)))
            } else {
              setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))
            }
          }}
        >
          <div className="map-canvas figma-floor-map" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, aspectRatio: floorMapAspectRatios[floor.id] }} role="img" aria-label={`Interactive room layout for Floor ${floor.id}`}>
            <InteractiveFloorSvg floor={floor} rooms={rooms} activeRoomId={hoveredRoom ?? openedRoomId} onSelect={openRoomDetails} onHover={handleMapHover} onRoomNames={setFigmaRoomNames} dragMoved={dragMoved} />
          </div>
        </div>
        <div className="map-status"><span className="map-status-key"><i className="mapped"/>Mapped room</span><span className="map-status-key"><i className="computer"/>Computer present</span><span>Click a room to enter</span>{selectedRoom && <strong>{selectedRoom.name} · {selectedRoom.assets.length} assets</strong>}</div>
      </div>
      <aside id={`floor-${floor.id}-room-directory`} className="floor-room-directory" hidden={!directoryOpen}>
        <div className="directory-heading"><span className="eyebrow">ROOM DIRECTORY</span><h3>Floor {floor.id} spaces</h3><p>Select a room to inspect its inventory.</p></div>
        <div className="directory-list">{namedRooms.map((item, index) => {
          const pcs = computerCount(item)
          return <button key={item.id} className={`${pcs ? 'has-computer' : ''} ${item.id === openedRoomId ? 'is-open' : ''}`} onMouseEnter={() => setHoveredRoom(item.id)} onMouseLeave={() => setHoveredRoom(null)} onFocus={() => setHoveredRoom(item.id)} onBlur={() => setHoveredRoom(null)} onClick={() => openRoomDetails(item.id)}><span>{String(index + 1).padStart(2, '0')}</span><span><b>{item.name}</b><small>{item.department}</small></span>{pcs > 0 && <span className="directory-pc" aria-label={`${pcs} computer${pcs === 1 ? '' : 's'}`}><i />{pcs}</span>}<em>{item.assets.length}</em></button>
        })}</div>
      </aside>
    </div>
    {hoveredRoomDetails && hoverCardPosition && <div className="room-hover-card" style={{ left: hoverCardPosition.x, top: hoverCardPosition.y }} role="status" aria-live="polite">
      <div className="room-hover-card-heading"><span>ROOM QUICK VIEW</span><b>{hoveredRoomDetails.assets.length} assigned</b></div>
      <h3>{hoveredRoomDetails.name}</h3>
      <p>{hoveredRoomDetails.code} · {hoveredRoomDetails.department}</p>
      <div className="room-hover-card-summary"><span><b>{hoveredRoomDetails.assets.length}</b> Devices</span><span><b>{computerCount(hoveredRoomDetails)}</b> Computers</span></div>
      <div className="room-hover-device-list">
        {hoveredRoomDetails.assets.length ? hoveredRoomDetails.assets.slice(0, 4).map(device => <div key={device.id}><i className={`dot ${statusClass(device.status)}`} /><span><b>{device.id}</b><small>{device.kind} · {device.detail}</small></span><em>{device.status}</em></div>) : <div className="room-hover-empty">No devices assigned to this room.</div>}
      </div>
    </div>}
    {openedRoom && <RoomEquipmentDialog key={openedRoom.id} room={openedRoom} floor={floor.id} onClose={() => setOpenedRoomId(null)} onAssignEquipment={() => onAssignEquipment(openedRoom)} />}
  </section>
}

function InteractiveFloorSvg({ floor, rooms, activeRoomId, onSelect, onHover, onRoomNames, dragMoved }: { floor: Floor; rooms: Room[]; activeRoomId: string | null; onSelect: (id: string) => void; onHover: (id: string | null, point?: { x: number; y: number }) => void; onRoomNames: (names: Record<string, string>) => void; dragMoved: React.MutableRefObject<boolean> }) {
  const [svgMarkup, setSvgMarkup] = useState('')
  const layerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    fetch(`/floor-plans/floor-${floor.id}.svg?v=${Date.now()}`)
      .then(response => response.text())
      .then(source => {
        if (!active) return
        const document = new DOMParser().parseFromString(source, 'image/svg+xml')
        prepareFloorPlanSvg(document)
        const roomShapes = Array.from(document.querySelectorAll('rect[fill="#D9D9D9"]'))
        roomShapes.forEach((shape, index) => {
          const mappedRoom = rooms[index]
          if (!mappedRoom) return
          decorateRoomShape(document, shape as SVGRectElement, mappedRoom, index)
        })
        setSvgMarkup(document.documentElement.outerHTML)
      })
    return () => { active = false }
  }, [floor.id, rooms])

  useEffect(() => {
    layerRef.current?.querySelectorAll<SVGGElement>('.svg-room-node, .svg-room-hit-target').forEach(node => {
      node.classList.toggle('is-active', node.getAttribute('data-room-id') === activeRoomId)
    })
  }, [activeRoomId, svgMarkup])

  useEffect(() => {
    const svg = layerRef.current?.querySelector('svg')
    if (!svg || !svgMarkup) return
    const structuralId = /^(?:Rectangle|Group|clip|paint|filter|mask|liveinv)/i
    const floorTitle = /^(?:GROUND|1ST|2ND|3RD|4TH|5TH|6TH|7TH)\s+FLOOR$/i
    const labels = Array.from(svg.querySelectorAll<SVGGraphicsElement>('[id]')).filter(element => {
      const label = cleanFigmaLabel(element.id)
      return label && !structuralId.test(label) && !floorTitle.test(label) && !element.closest('.svg-room-node')
    })
    const discoveredNames: Record<string, string> = {}

    svg.querySelectorAll<SVGGElement>('.svg-room-node').forEach(roomNode => {
      const roomId = roomNode.dataset.roomId
      const shape = roomNode.querySelector<SVGRectElement>('.svg-room-box')
      if (!roomId || !shape) return
      const roomBounds = shape.getBoundingClientRect()
      const matchingLabels = labels.filter(label => {
        const bounds = label.getBoundingClientRect()
        const centerX = bounds.left + bounds.width / 2
        const centerY = bounds.top + bounds.height / 2
        return bounds.width > 0 && bounds.height > 0 && centerX >= roomBounds.left - 2 && centerX <= roomBounds.right + 2 && centerY >= roomBounds.top - 2 && centerY <= roomBounds.bottom + 2
      }).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      const names = [...new Set(matchingLabels.map(label => cleanFigmaLabel(label.id)).filter(Boolean))]
      if (!names.length) return
      const roomName = names.join(' · ')
      discoveredNames[roomId] = roomName
      const title = roomNode.querySelector('title')
      if (title) title.textContent = roomName
      svg.querySelector<SVGRectElement>(`.svg-room-hit-target[data-room-id="${roomId}"]`)?.setAttribute('aria-label', `Open ${roomName}`)
    })

    onRoomNames(discoveredNames)
  }, [onRoomNames, svgMarkup])

  const roomIdFromTarget = (target: EventTarget | null) => target instanceof Element ? target.closest('.svg-room-node, .svg-room-hit-target')?.getAttribute('data-room-id') ?? null : null
  const selectTarget = (target: EventTarget | null) => { const id = roomIdFromTarget(target); if (id) onSelect(id) }

  return <div
    ref={layerRef}
    className="floor-svg-layer"
    dangerouslySetInnerHTML={{ __html: svgMarkup }}
    onPointerUp={event => { if (event.button === 0 && !dragMoved.current) selectTarget(event.target) }}
    onMouseMove={event => {
      const roomId = roomIdFromTarget(event.target)
      if (roomId) onHover(roomId, { x: event.clientX, y: event.clientY })
      else onHover(null)
    }}
    onMouseLeave={() => onHover(null)}
    onFocus={event => {
      const roomId = roomIdFromTarget(event.target)
      const target = event.target instanceof Element ? event.target.getBoundingClientRect() : null
      if (roomId && target) onHover(roomId, { x: target.right, y: target.top })
    }}
    onBlur={() => onHover(null)}
    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectTarget(event.target) } }}
  />
}

function cleanFigmaLabel(value: string) {
  return value.replace(/_\d+$/, '').replace(/\s+/g, ' ').trim()
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

function svgElement<K extends keyof SVGElementTagNameMap>(document: Document, name: K, attributes: Record<string, string>) {
  const element = document.createElementNS(SVG_NAMESPACE, name)
  Object.entries(attributes).forEach(([attribute, value]) => element.setAttribute(attribute, value))
  return element
}

function prepareFloorPlanSvg(document: Document) {
  const root = document.documentElement
  root.setAttribute('class', 'architectural-floor-plan')
  root.querySelectorAll<SVGElement>('[fill="white"]').forEach(background => background.setAttribute('fill', '#F4F6F5'))
  root.querySelectorAll<SVGElement>('[fill="#1E1E1E"]').forEach(background => background.setAttribute('fill', '#E8ECEA'))
  const floorTitle = /^(?:GROUND|1ST|2ND|3RD|4TH|5TH|6TH|7TH)\s+FLOOR$/i
  const structuralId = /^(?:Rectangle|Group|Circle|Ellipse|Line|Path|Vector|clip|paint|filter|mask|liveinv)/i
  root.querySelectorAll<SVGGraphicsElement>('[id]').forEach(element => {
    const label = cleanFigmaLabel(element.id)
    if (floorTitle.test(label)) element.remove()
    else if (label && !structuralId.test(label)) element.classList.add('figma-room-label')
  })

  const defs = svgElement(document, 'defs', {})
  const neutralPattern = svgElement(document, 'pattern', { id: 'liveinv-room-floor', width: '30', height: '30', patternUnits: 'userSpaceOnUse' })
  neutralPattern.appendChild(svgElement(document, 'rect', { width: '30', height: '30', fill: '#F8FAF9' }))
  neutralPattern.appendChild(svgElement(document, 'path', { d: 'M30 0H0V30', fill: 'none', stroke: '#E5EAE7', 'stroke-width': '1.5' }))
  const computerPattern = svgElement(document, 'pattern', { id: 'liveinv-room-floor-computer', width: '30', height: '30', patternUnits: 'userSpaceOnUse' })
  computerPattern.appendChild(svgElement(document, 'rect', { width: '30', height: '30', fill: '#F3F9F5' }))
  computerPattern.appendChild(svgElement(document, 'path', { d: 'M30 0H0V30', fill: 'none', stroke: '#D9E9DE', 'stroke-width': '1.5' }))
  defs.append(neutralPattern, computerPattern)
  root.prepend(defs)
  root.appendChild(svgElement(document, 'g', { id: 'liveinv-room-hit-layer' }))
}

function decorateRoomShape(document: Document, shape: SVGRectElement, mappedRoom: Room, index: number) {
  const parent = shape.parentNode
  if (!parent) return
  const x = Number(shape.getAttribute('x') ?? 0)
  const y = Number(shape.getAttribute('y') ?? 0)
  const width = Number(shape.getAttribute('width') ?? 0)
  const height = Number(shape.getAttribute('height') ?? 0)
  const pcs = computerCount(mappedRoom)
  const isGreen = pcs > 0 || (mappedRoom.floor === 2 && mappedRoom.assets.length > 0)
  const group = svgElement(document, 'g', {
    class: `svg-room-node ${mappedRoom.assets.length ? 'has-assets' : ''} ${isGreen ? 'has-computer' : ''}`,
    'data-room-id': mappedRoom.id,
  })
  parent.insertBefore(group, shape)
  group.appendChild(shape)
  shape.classList.add('svg-room-box')
  shape.setAttribute('rx', String(Math.min(5, width * .035, height * .035)))
  shape.setAttribute('ry', String(Math.min(5, width * .035, height * .035)))
  shape.setAttribute('vector-effect', 'non-scaling-stroke')

  const innerWall = svgElement(document, 'rect', {
    class: 'svg-room-inner-wall',
    x: String(x + 8),
    y: String(y + 8),
    width: String(Math.max(1, width - 16)),
    height: String(Math.max(1, height - 16)),
    rx: '3',
    ry: '3',
    'vector-effect': 'non-scaling-stroke',
  })
  group.appendChild(innerWall)

  const title = svgElement(document, 'title', {})
  title.textContent = `${mappedRoom.name} · ${mappedRoom.code} · ${mappedRoom.assets.length} assets`
  group.prepend(title)


  const hitTarget = svgElement(document, 'rect', {
    class: 'svg-room-hit-target',
    x: String(x),
    y: String(y),
    width: String(width),
    height: String(height),
    rx: String(Math.min(5, width * .035, height * .035)),
    ry: String(Math.min(5, width * .035, height * .035)),
    'data-room-id': mappedRoom.id,
    role: 'button',
    tabindex: '0',
    'aria-label': `Open ${mappedRoom.name}, ${mappedRoom.assets.length} assets${pcs ? `, ${pcs} computer${pcs === 1 ? '' : 's'}` : ''}`,
  })
  document.getElementById('liveinv-room-hit-layer')?.appendChild(hitTarget)

}

type EquipmentFilter = 'All' | Asset['kind']

function RoomEquipmentDialog({ room, floor, onClose, onAssignEquipment }: { room: Room; floor: number; onClose: () => void; onAssignEquipment: () => void }) {
  const [filter, setFilter] = useState<EquipmentFilter>('All')
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(room.assets[0]?.id ?? null)
  const selectedAsset = room.assets.find(assetItem => assetItem.id === selectedAssetId) ?? room.assets[0]
  const filters: EquipmentFilter[] = ['All', 'Computer', 'Printer', 'Monitor']
  const filteredAssets = filter === 'All' ? room.assets : room.assets.filter(assetItem => assetItem.kind === filter)
  const counts = room.assets.reduce<Record<Asset['kind'], number>>((result, assetItem) => {
    result[assetItem.kind] += 1
    return result
  }, { Computer: 0, Printer: 0, Monitor: 0 })
  const computers = room.assets.filter(assetItem => assetItem.kind === 'Computer')
  const computerPositions = [
    { left: '18%', top: '26%' }, { left: '61%', top: '23%' },
    { left: '27%', top: '62%' }, { left: '70%', top: '61%' },
    { left: '45%', top: '43%' }, { left: '83%', top: '39%' },
  ]

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const chooseFilter = (nextFilter: EquipmentFilter) => {
    setFilter(nextFilter)
    const first = nextFilter === 'All' ? room.assets[0] : room.assets.find(assetItem => assetItem.kind === nextFilter)
    setSelectedAssetId(first?.id ?? null)
  }

  return <div className="equipment-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="equipment-dialog" role="dialog" aria-modal="true" aria-labelledby="equipment-dialog-title">
      <header className="equipment-dialog-header">
        <div><span>FLOOR {floor} · ROOM {room.code}</span><h2 id="equipment-dialog-title">{room.name}</h2><p>{room.department} · Select equipment to view its details.</p></div>
        <button type="button" className="equipment-dialog-close" aria-label="Close equipment popup" onClick={onClose}>×</button>
      </header>
      <div className="equipment-summary-strip">
        <div><span>Total equipment</span><b>{room.assets.length}</b></div>
        <div><span className="equipment-kind-icon computer">▣</span><span>Computers</span><b>{counts.Computer}</b></div>
        <div><span className="equipment-kind-icon printer">▤</span><span>Printers</span><b>{counts.Printer}</b></div>
        <div><span className="equipment-kind-icon monitor">▱</span><span>Monitors</span><b>{counts.Monitor}</b></div>
      </div>
      {room.assets.length === 0 ? <div className="equipment-empty"><span>▣</span><h3>No equipment assigned</h3><p>This room does not currently have registered computers or equipment.</p><button type="button" onClick={() => { onClose(); onAssignEquipment() }}>＋ Assign equipment</button></div> : <div className="room-focus-layout">
        <section className="room-focus-visual" aria-label={`2D view of ${room.name}`}>
          <div className="room-focus-heading"><div><span>2D ROOM VIEW</span><h3>{room.name}</h3></div><strong>{computers.length} PC{computers.length === 1 ? '' : 's'}</strong></div>
          <div className="room-focus-plan">
            <div className="room-focus-grid" />
            <div className="room-focus-desk desk-a" /><div className="room-focus-desk desk-b" /><div className="room-focus-desk desk-c" />
            <div className="room-focus-door"><i /></div>
            {computers.map((computer, index) => {
              const position = computerPositions[index % computerPositions.length]
              return <button
                type="button"
                key={computer.id}
                className={`room-pc-marker ${computer.id === selectedAsset?.id ? 'selected' : ''} ${statusClass(computer.status)}`}
                style={position}
                aria-label={`View ${computer.id}, ${computer.detail}`}
                onClick={() => { setFilter('Computer'); setSelectedAssetId(computer.id) }}
              ><span className="room-pc-screen"><i /></span><b>{computer.id}</b><small>{computer.detail}</small></button>
            })}
            {!computers.length && <div className="room-focus-no-pc"><span>▣</span><b>No computers assigned</b><small>Other equipment is listed in the details panel.</small></div>}
          </div>
          <div className="room-focus-legend"><span><i className="active" />Active</span><span><i className="maintenance" />Maintenance</span><span>Click a PC icon to inspect it</span></div>
        </section>
        <section className="room-focus-details">
          <div className="room-focus-details-heading"><div><span>ASSIGNED EQUIPMENT</span><h3>Devices and models</h3></div><b>{room.assets.length}</b></div>
          <div className="equipment-filter-tabs" aria-label="Filter room equipment">
            {filters.map(item => <button type="button" key={item} className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => chooseFilter(item)}>{item === 'All' ? `All ${room.assets.length}` : `${item}s ${counts[item]}`}</button>)}
          </div>
          <div className="room-focus-device-list" aria-label="Equipment in this room">
            {filteredAssets.length ? filteredAssets.map(assetItem => <button type="button" key={assetItem.id} className={assetItem.id === selectedAsset?.id ? 'selected' : ''} onClick={() => setSelectedAssetId(assetItem.id)}>
              <span className={`equipment-list-icon ${assetItem.kind.toLowerCase()}`}>{assetItem.kind === 'Printer' ? '▤' : assetItem.kind === 'Monitor' ? '▱' : '▣'}</span>
              <span><b>{assetItem.id}</b><small>{assetItem.detail}</small></span>
              <i className={`dot ${statusClass(assetItem.status)}`} />
            </button>) : <p className="equipment-filter-empty">No {filter.toLowerCase()}s assigned to this room.</p>}
          </div>
          {selectedAsset && <article className="room-focus-selected">
            <div className="room-focus-selected-heading"><div><small>SELECTED EQUIPMENT</small><h3>{selectedAsset.id}</h3><p>{selectedAsset.detail}</p></div><em className={statusClass(selectedAsset.status)}><i />{selectedAsset.status}</em></div>
            <div className="room-focus-selected-grid"><Detail label="Type" value={selectedAsset.kind} /><Detail label="Model" value={selectedAsset.detail} /><Detail label="Department" value={room.department} />{selectedAsset.ip && <Detail label="IP address" value={selectedAsset.ip} />}</div>
          </article>}
        </section>
      </div>}
    </section>
  </div>
}

function RoomView({ room, floor, onBack, onAsset, onAssignEquipment }: { room:Room;floor:number;onBack:()=>void;onAsset:(id:string)=>void;onAssignEquipment:()=>void }) {
  const counts = room.assets.reduce<Record<string, number>>((result, asset) => ({ ...result, [asset.kind]: (result[asset.kind] ?? 0) + 1 }), {})
  return <section className="workspace room-workspace">
    <div className="page-heading room-heading"><div><button className="back" onClick={onBack}>← Floor {floor} map</button><span className="eyebrow">ROOM {room.code} / FLOOR {floor}</span><h1>{room.name}</h1><p>{room.assets.length} assets assigned · {room.department}</p></div><button className="primary-action" onClick={onAssignEquipment}>＋ Assign item</button></div>
    <div className="room-category-strip"><div><span>Total assets</span><b>{room.assets.length}</b></div>{(['Computer', 'Printer', 'Monitor'] as const).map(kind => <div key={kind}><span>{kind}s</span><b>{counts[kind] ?? 0}</b></div>)}<div><span>Room code</span><b>{room.code}</b></div></div>
    <div className="room-stage"><div className="room-plan"><div className="room-grid"/><div className="plan-title">{room.name}<small>Interactive asset placement · hover or click a marker</small></div><div className="desk desk-one"/><div className="desk desk-two"/><div className="desk desk-three"/>{room.assets.map((item,index) => <button key={item.id} className={`asset-pin pin-${index} ${statusClass(item.status)}`} onClick={() => onAsset(item.id)}><span>{item.kind === 'Printer' ? '▤' : item.kind === 'Monitor' ? '▱' : '▣'}</span><b>{item.id}</b><small>{item.detail}</small></button>)}</div><div className="room-side"><h3>Assets in this room</h3><p className="muted">Select an item to view its details, network data, and assignment history.</p>{room.assets.map(asset => <button className="asset-list-item" key={asset.id} onClick={() => onAsset(asset.id)}><span className={`asset-kind ${statusClass(asset.status)}`}>{asset.kind === 'Printer' ? '▤' : asset.kind === 'Monitor' ? '▱' : '▣'}</span><span><b>{asset.id}</b><small>{asset.detail}</small></span><i>→</i></button>)}<button className="outline-full" onClick={onAssignEquipment}>＋ Assign item to this room</button></div></div>
  </section>
}

function AssetView({ room, floor, asset, onBack }: {room:Room;floor:number;asset:Asset;onBack:()=>void}) { return <section className="workspace"><div className="page-heading asset-heading"><div><button className="back" onClick={onBack}>← {room.name}</button><span className="eyebrow">ASSET DETAILS</span><h1>{asset.id} <em className={statusClass(asset.status)}>{asset.status}</em></h1><p>{asset.detail} · {asset.kind}</p></div><button className="primary-action">Edit asset</button></div><div className="asset-detail-grid"><div className="asset-hero"><div className={`asset-illustration ${asset.kind.toLowerCase()}`}>{asset.kind === 'Printer' ? '▤' : asset.kind === 'Monitor' ? '▱' : '▣'}</div><h2>{asset.id}</h2><p>{asset.detail}</p><div className="qr-card"><div className="fake-qr">▦</div><span><b>QR asset label</b><small>Scan to view or reassign</small></span><button>⌄</button></div></div><div className="detail-card"><div className="tabs"><b>Details</b><span>Specifications</span><span>History</span></div><div className="details"><Detail label="Category" value={asset.kind} /><Detail label="Status" value={asset.status} dot={asset.status}/><Detail label="Assigned to" value={`Floor ${floor} / ${room.name}`} /><Detail label="Asset tag" value={asset.id} /><Detail label="Brand" value="Dell" /><Detail label="Model" value={asset.detail.replace('Dell ', '')} />{asset.ip && <><Detail label="IPv4 address" value={asset.ip} /><Detail label="Hostname" value="HOSP-MEDREC-034" /><Detail label="Address method" value="DHCP reservation" /></>}</div></div></div></section> }
function Detail({label,value,dot}:{label:string;value:string;dot?:Status}) { return <div className="detail"><span>{label}</span><b>{dot && <i className={`dot ${statusClass(dot)}`}/>} {value}</b></div> }
