/*
  Servis çalışanı — uygulamayı ahırda internetsiz açabilmek için.

  Strateji: "önce ağ, sonra önbellek" (network-first).
  Sebebi: program sık güncelleniyor ve kullanıcıya eski sürümü göstermek
  yem değerleri söz konusuyken kabul edilemez. Ağ varsa her zaman taze dosya
  alınır ve önbelleğe yazılır; ağ yoksa son çalışan sürüm açılır.

  Supabase istekleri ASLA önbelleğe alınmaz: bayat bir rasyon verisi
  göstermektense hiç göstermemek doğrudur.
*/
const ONBELLEK = 'topaloglu-rasyon-v1'

/**
 * Sayfanın kabuğunu ve onun istediği betik/stil dosyalarını önbelleğe alır.
 *
 * Dosya adlarında derleme özeti var (index-8IuOJL3e.js) ve bu betiğe elle
 * yazılamaz. Bu yüzden liste index.html'in kendisinden okunur: kurulumdan
 * sonra sayfa indirilip içindeki `src`/`href` bağlantıları çıkarılır.
 *
 * Gerekli, çünkü ilk açılışta servis çalışanı henüz devrede değildir ve o
 * açılışın istekleri önbelleğe girmez; bu yapılmazsa uygulama çevrimdışı
 * yenilendiğinde kabuk geliyor ama betikleri gelmiyor, ekran boş kalıyordu.
 */
async function kabugunuTopla() {
  const onbellek = await caches.open(ONBELLEK)
  /*
    Kabuk TEK TEK alınır, addAll ile değil. addAll atomiktir: listedeki bir
    adres 404 verince hiçbiri önbelleğe girmez ve hata da yutulur — yani
    çevrimdışı açılış sessizce ölür. Dizin adresi (`./`) her sunucuda
    index.html servis etmiyor (nesne depolamaları vermiyor); o başarısız
    olsa bile `./index.html` önbellekte olmalı, getirme tarafındaki gezinti
    yedeği ona bakıyor.
  */
  await Promise.all(
    ['./', './index.html'].map((y) => onbellek.add(y).catch(() => undefined)),
  )

  try {
    const yanit = await fetch('./index.html', { cache: 'reload' })
    const metin = await yanit.text()
    const yollar = new Set()
    const desen = /(?:src|href)="(\.\/[^"]+\.(?:js|css|png|svg|webmanifest))"/g
    let e
    while ((e = desen.exec(metin)) !== null) yollar.add(e[1])

    /*
      Giriş betiğinin İÇİNDEKİ parçalar da alınır.
      Bulut kitaplığı `import()` ile ayrı bir parçaya konuyor ve adı yalnızca
      giriş betiğinin içinde geçiyor — index.html'de yok. Önbelleğe alınmazsa
      çevrimdışı açılışta "Failed to fetch dynamically imported module" veriyor
      ve program hiç açılmıyordu.
    */
    for (const yol of [...yollar].filter((y) => y.endsWith('.js'))) {
      try {
        const betikAdresi = new URL(yol, self.location.href)
        const betik = await (await fetch(yol, { cache: 'reload' })).text()
        // Vite dinamik import'u betiğin KENDİ klasörüne göre yazıyor
        // (`"./index-XYZ.js"`), `assets/` öneki olmadan. Bu yüzden eşleşen her
        // yol betiğin adresine göre çözülür, düz metin olarak aranmaz.
        const parca = /["'`]([^"'`\s]+\.js)["'`]/g
        let p
        while ((p = parca.exec(betik)) !== null) {
          try {
            const mutlak = new URL(p[1], betikAdresi)
            if (mutlak.origin === self.location.origin) yollar.add(mutlak.pathname)
          } catch {
            /* yol değilse atla */
          }
        }
      } catch {
        /* okunamadıysa o parça atlanır */
      }
    }

    await Promise.all([...yollar].map((y) => onbellek.add(y).catch(() => undefined)))
  } catch {
    /* ağ yoksa bir sonraki açılışta yeniden denenir */
  }
}

self.addEventListener('install', (olay) => {
  // Yeni sürüm beklemeden devralsın; kullanıcı iki kez açmak zorunda kalmasın.
  self.skipWaiting()
  olay.waitUntil(kabugunuTopla())
})

self.addEventListener('activate', (olay) => {
  olay.waitUntil(
    caches.keys()
      .then((adlar) => Promise.all(adlar.filter((a) => a !== ONBELLEK).map((a) => caches.delete(a))))
      .then(() => self.clients.claim())
      // Kurulum sırasında ağ yoksa liste eksik kalmış olabilir; burada tazelenir.
      .then(() => kabugunuTopla()),
  )
})

self.addEventListener('fetch', (olay) => {
  const istek = olay.request
  if (istek.method !== 'GET') return

  const adres = new URL(istek.url)
  // Başka bir kaynağa giden her şey (Supabase dahil) doğrudan ağa gider.
  if (adres.origin !== self.location.origin) return

  olay.respondWith(
    fetch(istek)
      .then((yanit) => {
        if (yanit && yanit.status === 200 && yanit.type === 'basic') {
          const kopya = yanit.clone()
          caches.open(ONBELLEK).then((c) => c.put(istek, kopya)).catch(() => undefined)
        }
        return yanit
      })
      .catch(async () => {
        /*
          `ignoreVary` şart. Sunucu yanıtlarında `Vary: Origin` geliyor ve
          önbelleğe koyan istek (servis çalışanının kendi `add`'i) ile sayfanın
          betik isteği bu başlıkta ayrışıyor; varsayılan eşleşme ıskalıyor ve
          çevrimdışı yenilemede betik dosyaları 503 dönüyordu — kabuk geliyor,
          ekran boş kalıyordu.
        */
        const onbellekten = await caches.match(istek, { ignoreVary: true })
        if (onbellekten) return onbellekten
        // Sayfa gezintisi ise uygulamanın kabuğunu ver; SPA gerisini halleder.
        if (istek.mode === 'navigate') {
          const kabuk = await caches.match('./index.html', { ignoreVary: true })
          if (kabuk) return kabuk
        }
        return new Response('Çevrimdışı', { status: 503, statusText: 'Cevrimdisi' })
      }),
  )
})

/* ---------------------------------------------------------------------
   BİLDİRİMLER

   Yönetici panelden duyuru gönderdiğinde, program KAPALIYKEN bile telefonun
   bildirim çalması için gereken iki olay burada.

   Gövde her zaman JSON beklenmiyor: bir sağlayıcı boş ya da düz metin
   gönderirse `json()` patlar ve bildirim hiç görünmez. Bu yüzden çözümleme
   korumalı ve her durumda bir bildirim çıkıyor.
--------------------------------------------------------------------- */
self.addEventListener('push', (olay) => {
  let veri = {}
  try {
    veri = olay.data ? olay.data.json() : {}
  } catch {
    veri = { govde: olay.data ? olay.data.text() : '' }
  }
  const baslik = veri.baslik || 'Topaloğlu Rasyon Programı'
  olay.waitUntil(
    self.registration.showNotification(baslik, {
      body: veri.govde || '',
      icon: './ikon-192.png',
      badge: './ikon-192.png',
      // Aynı duyuru iki kez gelirse üst üste yığılmasın.
      tag: veri.duyuruId ? `duyuru-${veri.duyuruId}` : 'duyuru',
      data: { duyuruId: veri.duyuruId ?? null },
    }),
  )
})

self.addEventListener('notificationclick', (olay) => {
  olay.notification.close()
  /*
    Program zaten açıksa yeni sekme açmak yerine açık olanı öne getir:
    ahırdaki kişi aynı programın iki kopyasıyla uğraşmasın.
  */
  olay.waitUntil((async () => {
    const pencereler = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const p of pencereler) {
      if (p.url.startsWith(self.registration.scope)) return p.focus()
    }
    return self.clients.openWindow(self.registration.scope)
  })())
})
