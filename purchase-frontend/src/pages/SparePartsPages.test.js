import fs from 'fs';
import path from 'path';

const source=name=>fs.readFileSync(path.join(__dirname,name),'utf8');

describe('Spare Parts foundation page contracts',()=>{
  test('register preserves pagination and exposes manufacturer and equipment filters',()=>{const page=source('SparePartsRegisterPage.jsx');expect(page).toContain("q.page-1");expect(page).toContain("q.page+1");expect(page).toContain("'manufacturer'");expect(page).toContain("'equipment_id'");});
  test('form uses constrained Item Master selectors and controlled foundation fields',()=>{const page=source('SparePartFormPage.jsx');expect(page).toContain('searchGenericItems');expect(page).toContain('searchApprovedProducts');expect(page).toContain('generic_item_id:data.generic_item_id');expect(page).toContain("type=\"checkbox\"");expect(page).toContain('recommended_stocking_policy');expect(page).toContain("hasPermission(user,'spare-parts.manage-stock-policy')");expect(page).toContain("noMapping");});
  test('compatibility UI supports technical fields, editing, reapproval warning, and visible errors',()=>{const page=source('SparePartDetailPage.jsx');for(const field of ['equipment_id','compatibility_type','serial_number_from','serial_number_to','oem_confirmed','confirmation_reference','technical_notes','compatibility_status','approved_by','approved_at'])expect(page).toContain(field);expect(page).toContain('updateCompatibility');expect(page).toContain('reapprovalWarning');expect(page).toContain('role=\"alert\"');});
  test('equipment management supports search, create, edit, department and lifecycle',()=>{const page=source('EquipmentManagementPage.jsx');for(const value of ['search:query','createEquipment','updateEquipment','department_id','lifecycle_status'])expect(page).toContain(value);expect(page).not.toMatch(/depreciation|capitalization|custody|accounting/i);});
});