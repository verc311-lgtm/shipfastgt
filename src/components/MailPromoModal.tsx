import React from 'react';
import { Send } from 'lucide-react';
import { UserProfile } from '../types';

interface MailPromoModalProps {
  isOpen: boolean;
  recipient: UserProfile | null;
  subject: string;
  setSubject: (val: string) => void;
  body: string;
  setBody: (val: string) => void;
  promoImage: string;
  setPromoImage: (val: string) => void;
  promoImageName: string;
  setPromoImageName: (val: string) => void;
  onClose: () => void;
  emailJsServiceId: string;
  emailJsTemplateId: string;
  emailJsPublicKey: string;
  emailJsPrivateKey: string;
}

export const MailPromoModal: React.FC<MailPromoModalProps> = ({
  isOpen,
  recipient,
  subject,
  setSubject,
  body,
  setBody,
  promoImage,
  setPromoImage,
  promoImageName,
  setPromoImageName,
  onClose,
  emailJsServiceId,
  emailJsTemplateId,
  emailJsPublicKey,
  emailJsPrivateKey
}) => {
  if (!isOpen || !recipient) return null;

  const handleSendCustomMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      alert('Por favor complete el asunto y cuerpo del mensaje.');
      return;
    }

    const emailContentHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f3f4f6; padding: 40px 20px; color: #1f2937; line-height: 1.6; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border-top: 6px solid #ea580c;">
          <div style="padding: 30px; text-align: center; background-color: #ffffff; border-bottom: 1px solid #f3f4f6;">
            <img src="https://app.shipfastgt.com/logo.png" alt="ShipFast GT" style="max-width: 220px; height: auto;" />
          </div>
          <div style="padding: 40px 30px;">
            <h2 style="margin-top: 0; color: #111827; font-size: 20px; font-weight: 800; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">Notificación Especial - ShipFast GT</h2>
            <p style="font-size: 15px; color: #4b5563; margin-top: 25px;">
              Estimado/a <strong>${recipient.name}</strong>,
            </p>
            <div style="font-size: 14px; color: #4b5563; white-space: pre-line; margin-bottom: 25px;">
              ${body}
            </div>
            ${promoImage ? `
              <div style="margin: 30px 0; text-align: center; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
                <img src="${promoImage}" alt="Promoción / Imagen adjunta" style="max-width: 100%; height: auto; display: block; margin: 0 auto;" />
              </div>
            ` : ''}
            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; text-align: center; margin-top: 30px;">
              <strong style="color: #1e3a8a; font-size: 14px; display: block; margin-bottom: 10px;">💬 ¿Tienes alguna duda o necesitas asistencia?</strong>
              <p style="font-size: 13px; color: #4b5563; margin: 0 0 15px 0;">Ponte en contacto con nuestro equipo de soporte.</p>
              <a href="https://wa.me/50237268751" target="_blank" style="background-color: #25d366; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                🟢 Chat en Línea WhatsApp
              </a>
            </div>
          </div>
          <div style="background-color: #1f2937; padding: 30px; text-align: center; color: #9ca3af; font-size: 11px; border-top: 1px solid #374151;">
            <p style="margin: 0 0 8px 0; font-weight: bold; color: #ffffff;">ShipFast Logistics S.A. &copy; 2026</p>
          </div>
        </div>
      </div>
    `;

    const serviceId = emailJsServiceId.trim();
    const templateId = emailJsTemplateId.trim();
    const publicKey = emailJsPublicKey.trim();
    const privateKey = emailJsPrivateKey.trim();

    if (!serviceId || !templateId || !publicKey) {
      alert('Ajustes de EmailJS incompletos en Ajustes del Sistema.');
      return;
    }

    try {
      const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          accessToken: privateKey,
          template_params: {
            to_name: recipient.name,
            name: recipient.name,
            to_email: recipient.email,
            email: recipient.email,
            locker_id: recipient.lockerId,
            subject: subject,
            message: emailContentHtml
          }
        })
      });

      if (response.ok) {
        alert(`📧 Correo enviado exitosamente a ${recipient.name}.`);
        setSubject('');
        setBody('');
        setPromoImage('');
        setPromoImageName('');
        onClose();
      } else {
        const errorText = await response.text();
        alert(`Error al enviar correo: ${errorText}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error de red al intentar enviar el correo.");
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPromoImageName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPromoImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 bg-brand-gray-dark/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 bg-orange-50/50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-brand-orange text-white p-2 rounded-xl flex items-center justify-center">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-brand-gray-dark uppercase tracking-wider">Enviar Correo y Promoción</h3>
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mt-0.5">Destinatario: {recipient.name} ({recipient.lockerId})</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-xs">✕</button>
        </div>

        <form onSubmit={handleSendCustomMail} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">Correo Electrónico de Destino</label>
            <input type="text" disabled value={recipient.email} className="w-full px-3 py-2 text-xs border border-gray-200 bg-slate-50 text-gray-400 font-semibold rounded-lg cursor-not-allowed font-mono" />
          </div>

          <div>
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">Asunto del Correo *</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ej: Nueva Promoción..."
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none font-bold text-brand-gray-dark"
            />
          </div>

          <div>
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">Cuerpo / Mensaje Principal *</label>
            <textarea
              rows={6}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escriba aquí los detalles..."
              className="w-full p-3 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none font-semibold text-brand-gray-dark leading-relaxed resize-none"
            />
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200/50 rounded-2xl space-y-2">
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block">Adjuntar Imagen Promocional (Opcional)</label>
            <div className="flex items-center gap-3">
              <label className="bg-brand-gray-dark hover:bg-gray-800 text-white font-extrabold text-[10px] px-4 py-2 rounded-xl cursor-pointer uppercase tracking-wider transition">
                📁 Cargar Imagen
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
              <span className="text-[10px] font-mono font-bold text-slate-500 truncate max-w-[200px]">{promoImageName || "Ningún archivo seleccionado"}</span>
            </div>
            
            {promoImage && (
              <div className="mt-3 relative border border-slate-200 rounded-lg overflow-hidden bg-white max-h-[140px] flex items-center justify-center">
                <img src={promoImage} alt="Vista Previa" className="max-h-[140px] max-w-full object-contain" />
                <button
                  type="button"
                  onClick={() => {
                    setPromoImage('');
                    setPromoImageName('');
                  }}
                  className="absolute right-2 top-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full text-[10px] w-5 h-5 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-100 justify-end">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-brand-gray-dark font-extrabold text-[10px] rounded-xl uppercase tracking-wider transition cursor-pointer">Cancelar</button>
            <button type="submit" className="px-6 py-2.5 bg-brand-orange hover:bg-brand-orange-hover text-white font-extrabold text-[10px] rounded-xl uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-orange-100">
              <Send className="h-3.5 w-3.5" />
              Enviar Correo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
