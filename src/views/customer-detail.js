import { createCrmActivity, listCrmActivities } from '../lib/crm-api.js';
import { createAction, createContact, listContacts } from '../lib/customer-detail-api.js';
import { listExternalSalesProfiles, updateCustomer } from '../lib/customers-api.js';

export async function renderCustomerDetail(container, { supabase, profile, customer, onBack }) {
  container.innerHTML = `<section class="page"><button class="back" id="back-customers">← Customers</button><header class="page-header"><div><p class="eyebrow">${customer.source.replaceAll('_', ' ')}</p><h1>${escapeHtml(customer.name)}</h1><p>${customer.status.replaceAll('_', ' ')}</p></div></header><section class="panel"><h2>Contact persons</h2><form id="contact-form" class="activity-form"><label>Name<input name="name" required /></label><label>Email<input name="email" type="email" /></label><label>Phone<input name="phone" /></label><button>Add contact</button></form><ul id="contact-list" class="activity-list"><li>Loading contacts…</li></ul></section><section class="panel"><h2>CRM activity</h2><form id="activity-form" class="activity-form"><label>Topic<select name="topic"><option>Price / Negotiation</option><option>Product / Spec Requirement</option><option>New Order / Forecast</option><option>Shipment Concern</option><option>Payment / Finance</option><option>Other</option></select></label><label>Channel<select name="channel"><option>Email</option><option>Call</option><option>Meeting</option><option>LINE</option><option>WhatsApp</option><option>Other</option></select></label><label class="wide">Note<textarea name="note" required></textarea></label><button>Add activity</button></form><div id="activity-message" role="status"></div><ul id="activity-list" class="activity-list"><li>Loading activity history…</li></ul><form id="action-form" class="activity-form"><label>Related activity<select name="activityId" id="activity-select"></select></label><label>Action<input name="action" required /></label><label>Due date<input name="dueDate" type="date" /></label><button>Create action</button></form></section></section>`;
  container.querySelector('#back-customers').addEventListener('click', onBack);
  const list = container.querySelector('#activity-list');
  const contactList = container.querySelector('#contact-list');
  const message = container.querySelector('#activity-message');
  if (profile?.role === 'ADMIN') renderCustomerEditor(container, { supabase, profile, customer, onBack, message });
  async function load() {
    try { const [items, contacts] = await Promise.all([listCrmActivities(supabase, customer.id), listContacts(supabase, customer.id)]); list.innerHTML = items.length ? items.map((item) => `<li><strong>${escapeHtml(item.topic)}</strong><span>${item.activity_date} · ${escapeHtml(item.channel)}</span><p>${escapeHtml(item.note)}</p></li>`).join('') : '<li>No activity recorded yet.</li>'; contactList.innerHTML = contacts.length ? contacts.map((contact) => `<li><strong>${escapeHtml(contact.name)}</strong><span>${escapeHtml(contact.email || contact.phone || 'No contact details')}</span></li>`).join('') : '<li>No contacts recorded yet.</li>'; container.querySelector('#activity-select').innerHTML = items.map((item) => `<option value="${item.id}">${escapeHtml(item.topic)} — ${item.activity_date}</option>`).join(''); }
    catch (error) { message.textContent = `Could not load CRM activity: ${error.message}`; }
  }
  container.querySelector('#activity-form').addEventListener('submit', async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await createCrmActivity(supabase, customer.id, Object.fromEntries(form)); event.currentTarget.reset(); message.textContent = 'Activity added.'; await load(); } catch (error) { message.textContent = error.message; } });
  container.querySelector('#contact-form').addEventListener('submit', async (event) => { event.preventDefault(); try { await createContact(supabase, customer.id, Object.fromEntries(new FormData(event.currentTarget))); event.currentTarget.reset(); await load(); } catch (error) { message.textContent = error.message; } });
  container.querySelector('#action-form').addEventListener('submit', async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await createAction(supabase, form.get('activityId'), { action: form.get('action'), dueDate: form.get('dueDate') }); event.currentTarget.reset(); message.textContent = 'Action created.'; } catch (error) { message.textContent = error.message; } });
  await load();
}

function renderCustomerEditor(container, { supabase, profile, customer, onBack, message }) {
  const editor = document.createElement('section');
  editor.className = 'panel';
  editor.innerHTML = '<button id="edit-customer" class="link-button">Edit customer</button><div id="customer-editor"></div>';
  container.querySelector('.panel').before(editor);

  editor.querySelector('#edit-customer').addEventListener('click', async () => {
    try {
      const owners = await listExternalSalesProfiles(supabase);
      const ownerOptions = ['<option value="">Select External Sales owner</option>', ...owners.map((owner) => `<option value="${owner.id}" ${owner.id === customer.owner_profile_id ? 'selected' : ''}>${escapeHtml(owner.email)}</option>`)].join('');
      editor.querySelector('#customer-editor').innerHTML = `<h2>Edit customer</h2><form id="customer-edit-form" class="activity-form"><label>Customer code<input name="customerCode" required value="${escapeHtml(customer.customer_code || '')}"></label><label>Customer name<input name="name" required value="${escapeHtml(customer.name)}"></label><label>Source<select name="source"><option value="DIRECT_WCAT" ${customer.source === 'DIRECT_WCAT' ? 'selected' : ''}>Direct WCAT</option><option value="EXTERNAL_SALES" ${customer.source === 'EXTERNAL_SALES' ? 'selected' : ''}>External Sales</option></select></label><label>Status<select name="status"><option value="PROSPECT" ${customer.status === 'PROSPECT' ? 'selected' : ''}>Prospect</option><option value="ACTIVE_CUSTOMER" ${customer.status === 'ACTIVE_CUSTOMER' ? 'selected' : ''}>Active Customer</option><option value="INACTIVE" ${customer.status === 'INACTIVE' ? 'selected' : ''}>Inactive</option></select></label><label id="owner-field">External Sales owner<select name="ownerProfileId">${ownerOptions}</select></label><button>Save customer</button></form>`;
      const form = editor.querySelector('#customer-edit-form');
      const ownerField = editor.querySelector('#owner-field');
      const syncSourceFields = () => {
        const externalSales = form.elements.source.value === 'EXTERNAL_SALES';
        ownerField.hidden = !externalSales;
        form.elements.status.disabled = externalSales;
        if (externalSales) form.elements.status.value = 'ACTIVE_CUSTOMER';
      };
      form.elements.source.addEventListener('change', syncSourceFields);
      syncSourceFields();
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
          const values = Object.fromEntries(new FormData(form));
          const updated = await updateCustomer(supabase, customer.id, values);
          Object.assign(customer, updated);
          await renderCustomerDetail(container, { supabase, profile, customer, onBack });
        } catch (error) { message.textContent = error.message; }
      });
    } catch (error) { message.textContent = `Could not load edit options: ${error.message}`; }
  });
}

function escapeHtml(value) { const element = document.createElement('span'); element.textContent = value; return element.innerHTML; }
