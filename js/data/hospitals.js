const facility = (id, code, name, category, type, address, lat, lng, status, available, total, specialties) => ({
  id,
  code,
  name,
  category,
  type,
  address,
  lat,
  lng,
  status,
  available,
  total,
  specialties,
  specialtyAvailability: Object.fromEntries(specialties.map((specialty) => [specialty, true])),
  lastUpdated: new Date().toISOString()
});

export const HOSPITALS = [
  facility("vmc", "VMC", "Valenzuela Medical Center", "Hospital", "Public Tertiary (DOH)", "Padrigal St., Karuhatan, Valenzuela City", 14.6912, 120.9745, "Moderate", 6, 40, ["Emergency", "Trauma", "Cardiology", "Pediatrics", "Neurology", "OB-GYN", "General Surgery"]),
  facility("vceh", "VCEH", "Valenzuela City Emergency Hospital", "Hospital", "Public Emergency", "Poblacion (Polo), Valenzuela City", 14.7285, 120.9558, "Available", 5, 16, ["Emergency", "Trauma", "General Medicine", "Pediatrics"]),
  facility("acemc-val", "ACEMC", "Allied Care Experts (ACE) Medical Center - Valenzuela", "Hospital", "Private Medical Center", "548 McArthur Highway, Malanday, Valenzuela City", 14.7168, 120.9619, "Available", 7, 24, ["Emergency", "Cardiology", "Pediatrics", "OB-GYN", "General Surgery"]),
  facility("fumc", "FUMC", "Fatima University Medical Center", "Hospital", "Private Tertiary", "120 McArthur Highway, Marulas, Valenzuela City", 14.6785, 120.9815, "Moderate", 4, 28, ["Emergency", "Trauma", "Cardiology", "Pediatrics", "Neurology", "OB-GYN", "General Surgery"]),
  facility("vcmc", "VCMC", "Valenzuela Citicare Medical Center", "Hospital", "Private Medical Center", "McArthur Highway, Malinta, Valenzuela City", 14.6964, 120.9806, "Available", 5, 18, ["Emergency", "Cardiology", "Pediatrics", "OB-GYN", "General Medicine"]),
  facility("cgh", "CGH", "Calalang General Hospital", "Hospital", "Private General Hospital", "16 R. Valenzuela St. / McArthur Hwy cor. 4th St., BBB, Marulas", 14.6742, 120.9824, "Available", 4, 15, ["Emergency", "General Medicine", "Pediatrics", "OB-GYN"]),
  facility("srgh", "SRGH", "Sanctissimo Rosario General Hospital", "Hospital", "Private General Hospital", "2 Espiritu St., Marulas, Valenzuela City", 14.6768, 120.9838, "Moderate", 2, 12, ["Emergency", "General Medicine", "Pediatrics", "OB-GYN"]),
  facility("mv-romano", "MVRMH", "M.V. Romano Hospital", "Hospital", "Private Hospital", "Balubaran, Malinta, Valenzuela City", 14.6948, 120.9852, "Available", 3, 10, ["Emergency", "General Medicine", "Pediatrics", "OB-GYN"]),
  facility("fm-cruz", "FMCOGH", "F.M. Cruz Orthopedic & General Hospital", "Hospital", "Private Specialty / General", "Prudencia Subd., Marulas, Valenzuela City", 14.6795, 120.9795, "Available", 3, 10, ["Emergency", "Orthopedics", "Trauma", "General Surgery"]),
  facility("st-johns", "SJH", "St. John's Hospital", "Hospital", "Private Hospital", "323 Malinta, Valenzuela City", 14.6978, 120.9802, "Full / Diverting", 0, 10, ["Emergency", "General Medicine", "Pediatrics"]),
  facility("hernandez-mat", "FPHMH", "F&P Hernandez Maternity & Lying-in Hospital", "Clinic / Lying-in", "Maternity & Lying-in", "#17 McArthur Highway, Marulas, Valenzuela City", 14.6725, 120.9821, "Available", 2, 8, ["OB-GYN", "Maternity", "Newborn Care"]),
  facility("pasolo-mat", "PMMC", "Pasolo Maternity and Medical Center", "Clinic / Lying-in", "Maternity & Medical", "87 Pasolo St., Valenzuela City", 14.7235, 120.9605, "Available", 2, 8, ["OB-GYN", "Maternity", "General Medicine"]),
  facility("tmc-sm-val", "TMC-SM", "The Medical City Clinic - SM City Valenzuela", "Clinic / Lying-in", "Outpatient & Diagnostic Clinic", "G/F SM City Valenzuela, McArthur Hwy, Karuhatan", 14.6896, 120.9772, "Available", 2, 4, ["General Medicine", "Pediatrics", "Cardiology", "Diagnostics"]),
  facility("carlos-clinic", "CCLC", "Carlos Clinic", "Clinic / Lying-in", "Outpatient Clinic", "8/257 Palasan St., Valenzuela City", 14.7252, 120.9585, "Available", 1, 4, ["General Medicine", "Pediatrics"]),
  facility("hc-maysan", "HC-MAY", "Maysan Health Station", "Health Center", "Barangay Health Station", "Maysan Rd., Maysan, Valenzuela City", 14.7055, 120.9708, "Available", 1, 3, ["Primary Care", "Maternal Care", "Immunization"]),
  facility("hc-malinta", "HC-MAL", "Malinta Health Center", "Health Center", "City Health Station", "Malinta, Valenzuela City", 14.6961, 120.9804, "Moderate", 1, 4, ["Primary Care", "Maternal Care", "Immunization"]),
  facility("hc-gen-t", "HC-GTL", "Gen. T. De Leon Health Station", "Health Center", "City Health Station", "Gen. T. De Leon, Valenzuela City", 14.6865, 120.9912, "Available", 2, 4, ["Primary Care", "Maternal Care", "Immunization"]),
  facility("hc-ugong", "HC-UGG", "Ugong Health Station", "Health Center", "City Health Station", "Ugong, Valenzuela City", 14.7045, 120.9945, "Available", 1, 3, ["Primary Care", "Maternal Care", "Immunization"])
];
