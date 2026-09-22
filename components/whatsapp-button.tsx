import { whatsappHref } from '@/content/site';

// The number and the prefilled message both come from content/site.ts. They
// were hard-coded here as well, which is two places to change one number and
// one of them would have been missed.
export function WhatsAppButton() {
  return (
    <a
      href={whatsappHref()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      data-testid="whatsapp-button"
      className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] shadow-lg transition hover:scale-105 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14"
    >
      <svg viewBox="0 0 32 32" fill="white" className="h-7 w-7" aria-hidden="true">
        <path d="M16.004 3.2c-7.07 0-12.8 5.73-12.8 12.8 0 2.26.6 4.44 1.73 6.37L3.2 28.8l6.6-1.7a12.74 12.74 0 0 0 6.2 1.58h.004c7.07 0 12.8-5.73 12.8-12.8s-5.73-12.68-12.8-12.68Zm0 23.1a10.6 10.6 0 0 1-5.4-1.47l-.39-.23-3.9 1 1.04-3.8-.25-.39a10.55 10.55 0 0 1-1.62-5.61c0-5.85 4.76-10.6 10.6-10.6 2.83 0 5.49 1.1 7.49 3.11a10.52 10.52 0 0 1 3.1 7.5c0 5.85-4.76 10.5-10.67 10.5Zm5.8-7.87c-.32-.16-1.88-.93-2.17-1.03-.29-.11-.5-.16-.71.16-.21.32-.82 1.03-1 1.24-.19.21-.37.24-.69.08-.32-.16-1.34-.49-2.55-1.57-.94-.84-1.58-1.87-1.76-2.19-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.55.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.71-.97-2.34-.26-.62-.52-.53-.71-.54h-.6c-.21 0-.56.08-.85.4-.29.32-1.11 1.08-1.11 2.64s1.14 3.06 1.3 3.27c.16.21 2.24 3.42 5.43 4.8.76.33 1.35.52 1.81.67.76.24 1.45.21 2 .13.61-.09 1.88-.77 2.14-1.51.27-.75.27-1.38.19-1.51-.08-.13-.29-.21-.61-.37Z" />
      </svg>
      <span className="sr-only">Chat with us on WhatsApp</span>
    </a>
  );
}
