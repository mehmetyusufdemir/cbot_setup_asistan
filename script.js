// Markdown çıktısını temizleyen fonksiyon - geliştirilmiş
function sanitizeMarkdown(markdown) {
    if (!markdown) return '';
    
    // Özel karakterleri temizle, türkçe karakterleri koru
    let cleanMd = markdown
        .replace(/\n\n+/g, '\n\n') // Fazla satır boşluklarını temizle
        .replace(/\u200B/g, '') // Sıfır genişlikli boşlukları temizle
        .replace(/\\n/g, '\n') // Kaçış dizisi olan yeni satırları gerçek yeni satırlarla değiştir
        .replace(/\\"/g, '"') // Kaçış dizisi olan çift tırnakları gerçek çift tırnaklarla değiştir
        .trim();
    
    // ASCII olmayan karakterleri temizleme kodu kaldırıldı - Türkçe karakter desteği için
    return cleanMd;
}

// Geliştirilmiş Markdown to HTML dönüştürücü fonksiyon
function convertMarkdownToHtml(markdown) {
    if (!markdown) return '';
    
    // Headings
    let html = markdown
        .replace(/### (.*)/g, '<h3>$1</h3>')
        .replace(/## (.*)/g, '<h2>$1</h2>')
        .replace(/# (.*)/g, '<h1>$1</h1>');
    
    // Lists - geliştirilmiş liste desteği
    // Önce liste elemanlarını tespit et
    html = html.replace(/^\s*\* (.*)/gm, '<li>$1</li>');
    html = html.replace(/^\s*- (.*)/gm, '<li>$1</li>');
    html = html.replace(/^\s*\d+\. (.*)/gm, '<li>$1</li>');
    
    // Ardışık liste elemanlarını grupla
    html = html.replace(/(<li>.*<\/li>\n*)+/g, '<ul>$&</ul>');
    
    // Bold ve Italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // İç içe listeler için destek (basit düzeyde)
    html = html.replace(/<li>(.*)<ul>/g, '<li>$1</li><ul>');
    html = html.replace(/<\/ul>(.*)<\/li>/g, '</ul><li>$1</li>');
    
    // Paragraflar
    html = html.replace(/(.+?)(\n\n|$)/g, function(match, p1) {
        // Eğer p1 bir HTML etiketi ile başlıyorsa (örneğin <h1>, <ul> gibi) dönüştürme
        if (/<[a-z][\s\S]*>/i.test(p1)) {
            return p1 + "\n\n";
        }
        // Aksi takdirde paragraf olarak dönüştür
        return '<p>' + p1 + '</p>\n\n';
    });
    
    // Line breaks - mevcut paragraf yapısını koruyarak
    html = html.replace(/([^>])\n([^<])/g, '$1<br>$2');
    
    return html;
}

// Form gönderme işlemi
document.getElementById('requirementForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Butonları devre dışı bırak
    document.getElementById('generateBtn').disabled = true;
    
    // Form verilerini topla
    const formData = new FormData(this);
    const selectedModules = [];
    const selectedServices = [];
    
    document.querySelectorAll('input[name="modules"]:checked').forEach(checkbox => {
        selectedModules.push(checkbox.value);
    });
    
    document.querySelectorAll('input[name="services"]:checked').forEach(checkbox => {
        selectedServices.push(checkbox.value);
    });
    
    const requestData = {
        environment: formData.get('environment'),
        deploymentType: formData.get('deploymentType'),
        modules: selectedModules,
        services: selectedServices,
        dbType: formData.get('dbType'),
        ldapUsage: formData.get('ldapUsage')
    };
    
    // Loading göster, hata ve sonuç alanlarını gizle
    document.getElementById('loading').style.display = 'block';
    document.getElementById('result').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'none';
    
    // Demo modu mu yoksa gerçek API çağrısı mı?
    const useDemoMode = document.getElementById('demoModeToggle').checked;
    
    try {
        if (useDemoMode) {
            // Demo modu - API çağrısı yapmadan demo sonuç göster
            console.log("Demo mod aktif: Gerçek API çağrısı yapılmıyor");
            
            setTimeout(() => {
                const demoResult = generateDemoResult(requestData);
                document.getElementById('requirementsContent').innerHTML = demoResult;
                document.getElementById('loading').style.display = 'none';
                document.getElementById('result').style.display = 'block';
                document.getElementById('downloadBtn').style.display = 'block';
            }, 1500);
        } else {
            // Gerçek API çağrısı
            const aiFlowEndpoint = 'https://aiflow.test.cbot.ai/webhook-test/c36e4cfc-5263-4eab-b79f-88ec925db51b';
            
            const response = await fetch(aiFlowEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData),
                mode: 'cors',
                credentials: 'omit'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP hata! Durum: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            // Burada temizleme ve HTML dönüşümü yapıyoruz
            let markdownContent = '';
            
            // Sonuçları temizle ve göster
            if (result.html) {
                markdownContent = sanitizeMarkdown(result.html);
            } else if (result.output) {
                markdownContent = sanitizeMarkdown(result.output);
            } else {
                markdownContent = "Sonuç verileri alındı ancak içerik formatı anlaşılamadı.";
            }
            
            // marked.js yerine kendi fonksiyonumuz ile dönüştür
            const htmlContent = convertMarkdownToHtml(markdownContent);
            document.getElementById('requirementsContent').innerHTML = htmlContent;
            
            document.getElementById('loading').style.display = 'none';
            document.getElementById('result').style.display = 'block';
            document.getElementById('downloadBtn').style.display = 'block';
        }
    } catch (error) {
        console.error('Hata:', error);
        
        // Hata mesajını göster
        document.getElementById('loading').style.display = 'none';
        document.getElementById('errorMessage').style.display = 'block';
        document.getElementById('errorText').textContent = `Gereksinimler oluşturulurken bir hata oluştu: ${error.message}`;
        
        // CORS hatası varsa demo modu önermek için özel mesaj
        if (error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
            document.getElementById('errorText').innerHTML = `
                Gereksinimler oluşturulurken bir CORS hatası oluştu.<br><br>
                <strong>Çözüm:</strong> Sayfanın üst kısmındaki "Demo Modu" seçeneğini işaretleyip tekrar deneyin.<br>
                Bu, AIFlow ile bağlantı olmadan temel bir demo sonucu gösterecektir.<br><br>
                Gerçek entegrasyon için AIFlow webhook'unuza CORS ayarları eklenmelidir.
            `;
        }
    } finally {
        // Butonu tekrar aktif hale getir
        document.getElementById('generateBtn').disabled = false;
    }
});

// Geliştirilmiş format ve düzen ile PDF oluşturma
document.getElementById('downloadBtn').addEventListener('click', function() {
    const { jsPDF } = window.jspdf;
    
    // Önce yükleniyor mesajı göster
    const downloadBtn = document.getElementById('downloadBtn');
    const btnText = downloadBtn.textContent;
    downloadBtn.textContent = 'PDF Hazırlanıyor...';
    downloadBtn.disabled = true;
    
    try {
        // Mevcut içerik alanını al
        const requirementsContent = document.getElementById('requirementsContent');
        
        // Yazdırma için optimize edilmiş yeni bir alan oluştur
        const printContainer = document.createElement('div');
        printContainer.style.width = '210mm'; // A4 genişliği
        printContainer.style.padding = '20mm 15mm'; // Kenar boşlukları
        printContainer.style.backgroundColor = 'white';
        printContainer.style.color = 'black';
        printContainer.style.fontFamily = 'Arial, Helvetica, sans-serif';
        printContainer.style.position = 'fixed';
        printContainer.style.top = '0';
        printContainer.style.left = '0';
        printContainer.style.zIndex = '-1000';
        printContainer.style.lineHeight = '1.5';
        
        // Başlık ekle
        const header = document.createElement('div');
        header.innerHTML = `
            <div style="border-bottom: 2px solid #0066cc; margin-bottom: 20px; padding-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                <h1 style="color: #0066cc; font-size: 24px; margin: 0;">CBOT Kurulum Gereksinimleri</h1>
                <div style="font-size: 12px; color: #666;">${new Date().toLocaleDateString('tr-TR')}</div>
            </div>
        `;
        printContainer.appendChild(header);
        
        // İçeriği kopyala ama gelişmiş stil ve düzenle
        const contentClone = requirementsContent.cloneNode(true);
        
        // Stilleri iyileştir
        const headings = contentClone.querySelectorAll('h3');
        headings.forEach(heading => {
            heading.style.color = '#0066cc';
            heading.style.fontSize = '18px';
            heading.style.fontWeight = 'bold';
            heading.style.borderBottom = '1px solid #ddd';
            heading.style.paddingBottom = '8px';
            heading.style.marginTop = '25px';
            heading.style.marginBottom = '15px';
        });
        
        const paragraphs = contentClone.querySelectorAll('p');
        paragraphs.forEach(paragraph => {
            paragraph.style.margin = '0 0 12px 0';
            paragraph.style.lineHeight = '1.6';
            paragraph.style.textAlign = 'justify';
        });
        
        const lists = contentClone.querySelectorAll('ul');
        lists.forEach(list => {
            list.style.margin = '0 0 15px 0';
            list.style.paddingLeft = '20px';
        });
        
        const listItems = contentClone.querySelectorAll('li');
        listItems.forEach(item => {
            item.style.margin = '0 0 8px 0';
            item.style.paddingLeft = '5px';
        });
        
        // Güçlü metinleri vurgula
        const strongs = contentClone.querySelectorAll('strong');
        strongs.forEach(strong => {
            strong.style.color = '#333';
            strong.style.fontWeight = 'bold';
        });
        
        // Alt bilgi ekle
        const footer = document.createElement('div');
        footer.innerHTML = `
            <div style="margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px; display: flex; justify-content: space-between; font-size: 10px; color: #666;">
                <div>CBOT Kurulum Asistanı</div>
                <div>Sayfa 1</div>
            </div>
        `;
        
        // İçeriği ekle
        printContainer.appendChild(contentClone);
        printContainer.appendChild(footer);
        
        // Container'ı geçici olarak sayfaya ekle
        document.body.appendChild(printContainer);
        
        // PDF oluşturma işlemi
        setTimeout(() => {
            html2canvas(printContainer, {
                scale: 2, // Yüksek kalite
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                windowWidth: printContainer.offsetWidth,
                windowHeight: printContainer.offsetHeight
            }).then(canvas => {
                try {
                    // Canvas'tan görüntü verisi al
                    const imgData = canvas.toDataURL('image/jpeg', 1.0);
                    
                    // A4 formatında PDF oluştur
                    const pdf = new jsPDF({
                        orientation: 'portrait',
                        unit: 'mm',
                        format: 'a4',
                        compress: true
                    });
                    
                    // PDF boyutları
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = pdf.internal.pageSize.getHeight();
                    
                    // Canvas boyutları
                    const imgWidth = canvas.width;
                    const imgHeight = canvas.height;
                    
                    // En-boy oranını hesapla
                    const ratio = pdfWidth / imgWidth;
                    
                    // Görüntü yüksekliği PDF sayfasından büyükse birden fazla sayfaya böl
                    const totalPages = Math.ceil(imgHeight * ratio / pdfHeight);
                    
                    let heightLeft = imgHeight;
                    let position = 0;
                    
                    // İlk sayfayı ekle
                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight * ratio);
                    heightLeft -= pdfHeight / ratio;
                    position += pdfHeight / ratio;
                    
                    // Gerekirse ek sayfalar ekle
                    while (heightLeft > 0) {
                        pdf.addPage();
                        pdf.addImage(
                            imgData, 
                            'JPEG', 
                            0, // X başlangıç noktası
                            -position * ratio, // Y başlangıç noktası (negatif değer kaydırma için)
                            pdfWidth, 
                            imgHeight * ratio
                        );
                        
                        heightLeft -= pdfHeight / ratio;
                        position += pdfHeight / ratio;
                    }
                    
                    // Meta bilgileri ekle
                    pdf.setProperties({
                        title: 'CBOT Kurulum Gereksinimleri',
                        subject: 'Kurulum Teknik Gereksinimleri',
                        author: 'CBOT Kurulum Asistanı',
                        keywords: 'CBOT, kurulum, gereksinimler',
                        creator: 'CBOT Kurulum Asistanı'
                    });
                    
                    // Sayfa numaraları ekle
                    const pageCount = pdf.internal.getNumberOfPages();
                    for (let i = 1; i <= pageCount; i++) {
                        pdf.setPage(i);
                        pdf.setFont("helvetica", "italic");
                        pdf.setFontSize(10);
                        pdf.setTextColor(150, 150, 150);
                        pdf.text(`Sayfa ${i} / ${pageCount}`, pdfWidth - 25, pdfHeight - 10);
                    }
                    
                    // PDF'i kaydet
                    pdf.save('CBOT_Kurulum_Gereksinimleri.pdf');
                    
                } catch (error) {
                    console.error("PDF oluşturma hatası:", error);
                    alert("PDF oluşturulurken bir hata oluştu: " + error.message);
                } finally {
                    // Geçici container'ı kaldır
                    document.body.removeChild(printContainer);
                    
                    // Buton durumunu geri al
                    downloadBtn.textContent = btnText;
                    downloadBtn.disabled = false;
                }
            }).catch(error => {
                console.error("Canvas oluşturma hatası:", error);
                alert("Canvas oluşturulurken bir hata oluştu: " + error.message);
                
                // Geçici container'ı kaldır
                document.body.removeChild(printContainer);
                
                // Buton durumunu geri al
                downloadBtn.textContent = btnText;
                downloadBtn.disabled = false;
            });
        }, 100); // Küçük bir gecikme ile container'ın tam olarak oluşmasını sağlayalım
        
    } catch (error) {
        console.error("Genel hata:", error);
        alert("Beklenmeyen bir hata oluştu: " + error.message);
        
        // Buton durumunu geri al
        downloadBtn.textContent = btnText;
        downloadBtn.disabled = false;
    }
});

// Core veya Panel checkbox'larını kontrol et
function checkCoreAndPanel() {
    const coreChecked = document.getElementById('moduleCore').checked;
    const panelChecked = document.getElementById('modulePanel').checked;
    
    if (!coreChecked || !panelChecked) {
        if (!coreChecked) document.getElementById('moduleCore').checked = true;
        if (!panelChecked) document.getElementById('modulePanel').checked = true;
        
        alert('Core ve Panel modülleri her kurulum için gereklidir ve otomatik olarak seçilmiştir.');
    }
}

// Form gönderilmeden önce Core ve Panel seçili mi kontrol et
document.getElementById('generateBtn').addEventListener('click', function() {
    checkCoreAndPanel();
});

// Demo sonuç oluşturan fonksiyon
function generateDemoResult(data) {
    let result = `<h3>Seçilen Yapılandırma</h3>
    <p><strong>Ortam:</strong> ${data.environment === 'test' ? 'Test' : data.environment === 'prod' ? 'Canlı' : 'Test ve Canlı'}</p>
    <p><strong>Çalışma Ortamı:</strong> ${data.deploymentType === 'on-prem' ? 'On-Premise' : 'Bulut'}</p>
    <p><strong>Seçilen Modüller:</strong> ${data.modules.join(', ')}</p>
    <p><strong>Seçilen Yardımcı Servisler:</strong> ${data.services.length > 0 ? data.services.join(', ') : 'Yok'}</p>
    <p><strong>Veritabanı:</strong> ${data.dbType}</p>
    <p><strong>LDAP Kullanımı:</strong> ${data.ldapUsage === 'yes' ? 'Evet' : 'Hayır'}</p>
    
    <h3>Donanım Gereksinimleri</h3>
    <ul>`;
    
    // Core ve Panel her zaman seçili varsayalım
    result += `<li><strong>Core + Panel (Temel Sistem):</strong> 4 Core CPU, 16 GB RAM, 50 GB Disk</li>`;
    
    if (data.modules.includes('livechat')) {
        result += `<li><strong>LiveChat:</strong> 2 Core CPU, 8 GB RAM, 20 GB Disk</li>`;
    }
    
    if (data.modules.includes('fusion')) {
        result += `<li><strong>Fusion:</strong> 4 Core CPU, 16 GB RAM, 30 GB Disk</li>`;
    }
    
    if (data.modules.includes('classifier')) {
        result += `<li><strong>Classifier:</strong> 8 Core CPU, 32 GB RAM, 50 GB Disk</li>`;
    }
    
    if (data.modules.includes('aiflow')) {
        result += `<li><strong>AI Flow:</strong> 10 Core CPU, 8 GB RAM, 30 GB Disk</li>`;
    }
    
    if (data.modules.includes('analytics')) {
        result += `<li><strong>Analytics:</strong> 4 Core CPU, 16 GB RAM, 100 GB Disk</li>`;
    }
    
    // HF Model veya GPU gereksinimi
    if (data.services.includes('hfModel')) {
        result += `<li><strong>HF Model Hosting:</strong> GPU gereklidir (minimum 16 GB VRAM)</li>`;
    }
    
    if (data.services.includes('ocr')) {
        result += `<li><strong>OCR Servisi:</strong> 4 Core CPU, 16 GB RAM, GPU önerilir</li>`;
    }
    
    result += `</ul>
    
    <h3>Veritabanı Gereksinimleri</h3>
    <ul>
        <li><strong>Veritabanı Tipi:</strong> ${data.dbType.toUpperCase()}</li>
        <li><strong>Kullanıcı Yetkisi:</strong> OWNER yetkili olmalıdır</li>`;
        
    if (data.dbType === 'mssql') {
        result += `<li><strong>Collation:</strong> SQL_Latin1_General_CP1_CI_AS</li>`;
    }
    
    result += `<li><strong>IP ve Port Paylaşımı:</strong> Zorunludur</li>
    </ul>
    
    <h3>Network / Firewall</h3>
    <ul>
        <li>Sunucular internet erişimli olmalıdır</li>
        <li>Veritabanı portları açık olmalıdır (default ${data.dbType === 'mongodb' ? '27017' : data.dbType === 'mssql' ? '1433' : '5432'})</li>
        <li>5 DNS kaydı gereklidir:
            <ul>
                <li>cbot-panel -> 3000</li>
                <li>cbot-fusion -> 9600</li>
                <li>cbot-core -> 5351</li>
                <li>cbot-socket -> 5000 (WebSocket)</li>
                <li>${data.environment === 'test' || data.environment === 'both' ? '(test ortamları için sonuna -test eklenir)' : ''}</li>
            </ul>
        </li>
        <li>Load Balancer 5000 portunda WebSocket desteklemelidir</li>
    </ul>
    
    <h3>Docker Image ve Registry</h3>
    <ul>
        <li>Tüm servis image'ları registry.cbot.ai adresinden çekilir</li>
        <li>Sunucular 443 portundan bu adrese erişebilmelidir</li>
    </ul>`;
    
    if (data.ldapUsage === 'yes') {
        result += `
        <h3>LDAP Gereksinimleri</h3>
        <ul>
            <li>LDAP_URL, BIND_DN, SEARCH_BASE, SEARCH_FILTER sağlanmalıdır</li>
            <li>Email, Role, Name field'ları mapping yapılmalıdır</li>
            <li>Rollerin panelde LDAP ile birebir eşleşmesi gerekir</li>
        </ul>`;
    }
    
    if (data.modules.includes('aiflow')) {
        result += `
        <h3>AI Flow Ek Gereksinimleri</h3>
        <ul>
            <li>Minimum 10 Core CPU, 8 GB RAM</li>
            ${data.dbType === 'postgresql' ? '<li>PostgreSQL için 4 GB disk alanı ayrılmalıdır</li>' : ''}
        </ul>`;
    }
    
    result += `
    <div style="margin-top: 30px; padding: 15px; background-color: #f8f9fa; border-radius: 5px; font-style: italic;">
        <p><strong>Not:</strong> Bu demo sonuçtur. Gerçek API entegrasyonu için AIFlow'da CORS ayarları eklenmelidir.</p>
    </div>
    `;
    
    return result;
}

let rulesDocument = "";

// Kural dokümanını kaydet
document.getElementById('saveRulesBtn').addEventListener('click', function() {
    rulesDocument = document.getElementById('rulesDocument').value;
    if (rulesDocument.trim()) {
        document.getElementById('rulesStatus').textContent = "Kurallar kaydedildi!";
        document.getElementById('rulesStatus').style.color = "green";
    } else {
        document.getElementById('rulesStatus').textContent = "Lütfen kural dokümanını girin.";
        document.getElementById('rulesStatus').style.color = "red";
    }
});

// Chat işlevselliği
document.getElementById('sendBtn').addEventListener('click', sendMessage);
document.getElementById('userInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

async function sendMessage() {
    const userInput = document.getElementById('userInput').value;
    if (!userInput.trim()) return;
    
    // Kullanıcı mesajını göster
    addMessageToChat('user', userInput);
    document.getElementById('userInput').value = '';
    
    // Yükleniyor göstergesi ekle
    const loadingId = addLoadingMessage();
    
    try {
        // Webhook'a gönderilecek veri
        const requestData = {
            message: userInput,
            rules: rulesDocument,  // Kural dokümanını da gönder
            sessionId: getSessionId()
        };
        
        // AIFlow webhook endpoint'ine istek gönder
        const response = await fetch('https://aiflow.test.cbot.ai/webhook-test/80e7b84d-5d6c-499c-8e3f-2b5abf54b55e', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData),
            mode: 'cors',
            credentials: 'omit'
        });
        
        // Yükleniyor göstergesini kaldır
        removeLoadingMessage(loadingId);
        
        if (!response.ok) {
            throw new Error(`HTTP hata! Durum: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Bot yanıtını göster
        const botMessage = result.html || 'Yanıt alınamadı.';
        addMessageToChat('bot', botMessage);
    } catch (error) {
        console.error('Chat hatası:', error);
        // Yükleniyor göstergesini kaldır
        removeLoadingMessage(loadingId);
        // Hata mesajını göster
        addMessageToChat('error', 'Bağlantı hatası oluştu. Lütfen tekrar deneyin.');
    }
}

function addMessageToChat(sender, message) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender);
    messageElement.textContent = message;
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addLoadingMessage() {
    const messagesContainer = document.getElementById('chatMessages');
    const loadingElement = document.createElement('div');
    const id = 'loading-' + Date.now();
    loadingElement.id = id;
    loadingElement.classList.add('message', 'bot', 'loading');
    loadingElement.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
    messagesContainer.appendChild(loadingElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return id;
}

function removeLoadingMessage(id) {
    const loadingElement = document.getElementById(id);
    if (loadingElement) {
        loadingElement.remove();
    }
}

function getSessionId() {
    // Tarayıcı oturumu için benzersiz ID oluştur
    let sessionId = localStorage.getItem('chatSessionId');
    if (!sessionId) {
        sessionId = 'session_' + Date.now();
        localStorage.setItem('chatSessionId', sessionId);
    }
    return sessionId;
}

// Admin paneli değişkenleri
let modules = [
    { id: 'core', name: 'Core', cpu: '4 Core', ram: '16 GB', disk: '50 GB', required: true },
    { id: 'panel', name: 'Panel', cpu: '4 Core', ram: '16 GB', disk: '50 GB', required: true },
    { id: 'livechat', name: 'LiveChat', cpu: '2 Core', ram: '8 GB', disk: '20 GB', required: false },
    { id: 'fusion', name: 'Fusion', cpu: '4 Core', ram: '16 GB', disk: '30 GB', required: false },
    { id: 'classifier', name: 'Classifier', cpu: '8 Core', ram: '32 GB', disk: '50 GB', required: false },
    { id: 'aiflow', name: 'AI Flow', cpu: '10 Core', ram: '8 GB', disk: '30 GB', required: false },
    { id: 'analytics', name: 'Analytics', cpu: '4 Core', ram: '16 GB', disk: '100 GB', required: false }
];

let databases = [
    { id: 'mongodb', name: 'MongoDB', port: '27017', collation: '' },
    { id: 'mssql', name: 'MSSQL', port: '1433', collation: 'SQL_Latin1_General_CP1_CI_AS' },
    { id: 'postgresql', name: 'PostgreSQL', port: '5432', collation: '' }
];

let services = [
    { id: 'ocr', name: 'OCR', cpu: '4 Core', ram: '16 GB', requiresGPU: false },
    { id: 'masking', name: 'Maskeleme', cpu: '2 Core', ram: '4 GB', requiresGPU: false },
    { id: 'fileToMd', name: 'File to Markdown', cpu: '2 Core', ram: '4 GB', requiresGPU: false },
    { id: 'crawler', name: 'Crawler', cpu: '4 Core', ram: '8 GB', requiresGPU: false },
    { id: 'hfModel', name: 'HF Model Hosting', cpu: '8 Core', ram: '32 GB', requiresGPU: true }
];

// Admin paneli - giriş işlemi
document.getElementById('adminLoginBtn').addEventListener('click', function() {
    const password = document.getElementById('adminPassword').value;
    
    // Demo için basit bir parola kontrolü
    if (password === 'admin123') {
        document.getElementById('adminPanelContent').style.display = 'block';
        document.getElementById('adminPassword').value = '';
        
        // Liste yenilemelerini yap
        refreshModulesList();
        refreshDatabasesList();
        refreshServicesList();
        
        // Sistem kurallarını yükle
        document.getElementById('systemRules').value = rulesDocument || '';
    } else {
        alert('Hatalı şifre! Doğru şifreyi giriniz.');
    }
});

// Admin paneli - sekme değiştirme
document.querySelectorAll('.admin-tab-btn').forEach(button => {
    button.addEventListener('click', function() {
        // Tüm sekme butonlarını pasif yap
        document.querySelectorAll('.admin-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Tüm sekme içeriklerini gizle
        document.querySelectorAll('.admin-tab-content').forEach(content => {
            content.style.display = 'none';
        });
        
        // Seçilen sekme butonunu aktif yap
        this.classList.add('active');
        
        // Seçilen sekme içeriğini göster
        const tabId = this.getAttribute('data-tab');
        document.getElementById(tabId).style.display = 'block';
    });
});

// Modül listesini güncelle
function refreshModulesList() {
    const modulesList = document.getElementById('modulesList');
    modulesList.innerHTML = '';
    
    modules.forEach(module => {
        const item = document.createElement('div');
        item.className = 'admin-list-item';
        
        // Zorunlu modüller için silme butonu olmayacak
        if (module.required) {
            item.innerHTML = `
                <div><strong>${module.name}</strong> (${module.cpu}, ${module.ram}, ${module.disk}) - <span style="color: red;">Zorunlu</span></div>
            `;
        } else {
            item.innerHTML = `
                <div><strong>${module.name}</strong> (${module.cpu}, ${module.ram}, ${module.disk})</div>
                <button class="delete-btn" data-id="${module.id}">Sil</button>
            `;
        }
        
        modulesList.appendChild(item);
    });
    
    // Silme butonlarına event listeners ekle
    document.querySelectorAll('#modulesList .delete-btn').forEach(button => {
        button.addEventListener('click', function() {
            const moduleId = this.getAttribute('data-id');
            deleteModule(moduleId);
        });
    });
}

// Veritabanı listesini güncelle
function refreshDatabasesList() {
    const databasesList = document.getElementById('databasesList');
    databasesList.innerHTML = '';
    
    databases.forEach(db => {
        const item = document.createElement('div');
        item.className = 'admin-list-item';
        
        item.innerHTML = `
            <div><strong>${db.name}</strong> (Port: ${db.port}${db.collation ? ', Collation: ' + db.collation : ''})</div>
            <button class="delete-btn" data-id="${db.id}">Sil</button>
        `;
        
        databasesList.appendChild(item);
    });
    
    // Silme butonlarına event listeners ekle
    document.querySelectorAll('#databasesList .delete-btn').forEach(button => {
        button.addEventListener('click', function() {
            const dbId = this.getAttribute('data-id');
            deleteDatabase(dbId);
        });
    });
    
    // Ayrıca form alanını güncelle
    updateDatabaseSelect();
}

// Servis listesini güncelle
function refreshServicesList() {
    const servicesList = document.getElementById('servicesList');
    servicesList.innerHTML = '';
    
    services.forEach(service => {
        const item = document.createElement('div');
        item.className = 'admin-list-item';
        
        item.innerHTML = `
            <div><strong>${service.name}</strong> (${service.cpu}, ${service.ram}${service.requiresGPU ? ', <span style="color: blue;">GPU gerektirir</span>' : ''})</div>
            <button class="delete-btn" data-id="${service.id}">Sil</button>
        `;
        
        servicesList.appendChild(item);
    });
    
    // Silme butonlarına event listeners ekle
    document.querySelectorAll('#servicesList .delete-btn').forEach(button => {
        button.addEventListener('click', function() {
            const serviceId = this.getAttribute('data-id');
            deleteService(serviceId);
        });
    });
    
    // Ayrıca checkbox alanını güncelle
    updateServiceCheckboxes();
}

// Veritabanı select menüsünü güncelle
function updateDatabaseSelect() {
    const dbSelect = document.getElementById('dbType');
    const currentValue = dbSelect.value;
    
    // Mevcut seçenekleri temizle
    dbSelect.innerHTML = '';
    
    // Veritabanlarını ekle
    databases.forEach(db => {
        const option = document.createElement('option');
        option.value = db.id;
        option.textContent = db.name;
        dbSelect.appendChild(option);
    });
    
    // Önceki değeri korumaya çalış
    if (databases.some(db => db.id === currentValue)) {
        dbSelect.value = currentValue;
    }
}

// Servis checkbox alanını güncelle
function updateServiceCheckboxes() {
    const servicesContainer = document.querySelector('.section:nth-of-type(3) .checkbox-group');
    if (!servicesContainer) return;
    
    // Mevcut checkboxları hatırla
    const checkedServices = Array.from(servicesContainer.querySelectorAll('input[type="checkbox"]:checked'))
        .map(cb => cb.value);
    
    // Mevcut içeriği temizle
    servicesContainer.innerHTML = '';
    
    // Servisleri ekle
    services.forEach(service => {
        const item = document.createElement('div');
        item.className = 'checkbox-item';
        
        item.innerHTML = `
            <input type="checkbox" id="service${service.id}" name="services" value="${service.id}" ${checkedServices.includes(service.id) ? 'checked' : ''}>
            <label for="service${service.id}">${service.name}${service.requiresGPU ? ' (GPU gerektirir)' : ''}</label>
        `;
        
        servicesContainer.appendChild(item);
    });
}

// Modül checkbox alanını güncelle
function updateModuleCheckboxes() {
    const modulesContainer = document.querySelector('.section:nth-of-type(2) .checkbox-group');
    if (!modulesContainer) return;
    
    // Mevcut checkboxları hatırla
    const checkedModules = Array.from(modulesContainer.querySelectorAll('input[type="checkbox"]:checked'))
        .map(cb => cb.value);
    
    // Mevcut içeriği temizle
    modulesContainer.innerHTML = '';
    
    // Modülleri ekle
    modules.forEach(module => {
        const item = document.createElement('div');
        item.className = 'checkbox-item';
        
        item.innerHTML = `
            <input type="checkbox" id="module${module.id}" name="modules" value="${module.id}" ${checkedModules.includes(module.id) || module.required ? 'checked' : ''} ${module.required ? 'disabled' : ''}>
            <label for="module${module.id}">${module.name}${module.required ? ' (Zorunlu)' : ''}</label>
        `;
        
        modulesContainer.appendChild(item);
    });
}

// Modül ekle
document.getElementById('addModuleBtn').addEventListener('click', function() {
    const name = document.getElementById('newModuleName').value.trim();
    const cpu = document.getElementById('newModuleResourceCPU').value.trim();
    const ram = document.getElementById('newModuleResourceRAM').value.trim();
    const disk = document.getElementById('newModuleResourceDisk').value.trim();
    
    if (!name || !cpu || !ram || !disk) {
        alert('Lütfen tüm alanları doldurun!');
        return;
    }
    
    // ID için name'i küçük harfe çevir ve boşlukları kaldır
    const id = name.toLowerCase().replace(/\s+/g, '');
    
    // Aynı ID ile modül var mı kontrol et
    if (modules.some(m => m.id === id)) {
        alert('Bu isimde bir modül zaten var!');
        return;
    }
    
    // Yeni modülü ekle
    modules.push({
        id: id,
        name: name,
        cpu: cpu,
        ram: ram,
        disk: disk,
        required: false
    });
    
    // Formu temizle
    document.getElementById('newModuleName').value = '';
    document.getElementById('newModuleResourceCPU').value = '';
    document.getElementById('newModuleResourceRAM').value = '';
    document.getElementById('newModuleResourceDisk').value = '';
    
    // Listeleri güncelle
    refreshModulesList();
    updateModuleCheckboxes();
    
    alert(`${name} modülü başarıyla eklendi!`);
});

// Veritabanı ekle
document.getElementById('addDBBtn').addEventListener('click', function() {
    const name = document.getElementById('newDBName').value.trim();
    const port = document.getElementById('newDBPort').value.trim();
    const collation = document.getElementById('newDBCollation').value.trim();
    
    if (!name || !port) {
        alert('Lütfen en azından isim ve port alanlarını doldurun!');
        return;
    }
    
    // ID için name'i küçük harfe çevir ve boşlukları kaldır
    const id = name.toLowerCase().replace(/\s+/g, '');
    
    // Aynı ID ile veritabanı var mı kontrol et
    if (databases.some(db => db.id === id)) {
        alert('Bu isimde bir veritabanı zaten var!');
        return;
    }
    
    // Yeni veritabanını ekle
    databases.push({
        id: id,
        name: name,
        port: port,
        collation: collation
    });
    
    // Formu temizle
    document.getElementById('newDBName').value = '';
    document.getElementById('newDBPort').value = '';
    document.getElementById('newDBCollation').value = '';
    
    // Listeleri güncelle
    refreshDatabasesList();
    
    alert(`${name} veritabanı başarıyla eklendi!`);
});

// Servis ekle
document.getElementById('addServiceBtn').addEventListener('click', function() {
    const name = document.getElementById('newServiceName').value.trim();
    const cpu = document.getElementById('newServiceResourceCPU').value.trim();
    const ram = document.getElementById('newServiceResourceRAM').value.trim();
    const requiresGPU = document.getElementById('newServiceRequiresGPU').checked;
    
    if (!name || !cpu || !ram) {
        alert('Lütfen gerekli alanları doldurun!');
        return;
    }
    
    // ID için name'i küçük harfe çevir ve boşlukları kaldır
    const id = name.toLowerCase().replace(/\s+/g, '');
    
    // Aynı ID ile servis var mı kontrol et
    if (services.some(s => s.id === id)) {
        alert('Bu isimde bir servis zaten var!');
        return;
    }
    
    // Yeni servisi ekle
    services.push({
        id: id,
        name: name,
        cpu: cpu,
        ram: ram,
        requiresGPU: requiresGPU
    });
    
    // Formu temizle
    document.getElementById('newServiceName').value = '';
    document.getElementById('newServiceResourceCPU').value = '';
    document.getElementById('newServiceResourceRAM').value = '';
    document.getElementById('newServiceRequiresGPU').checked = false;
    
    // Listeleri güncelle
    refreshServicesList();
    
    alert(`${name} servisi başarıyla eklendi!`);
});

// Modül sil
function deleteModule(moduleId) {
    const index = modules.findIndex(m => m.id === moduleId);
    
    if (index === -1) return;
    
    const moduleName = modules[index].name;
    
    // Silme işlemini onayla
    if (!confirm(`"${moduleName}" modülünü silmek istediğinizden emin misiniz?`)) {
        return;
    }
    
    // Modülü sil
    modules.splice(index, 1);
    
    // Listeleri güncelle
    refreshModulesList();
    updateModuleCheckboxes();
    
    alert(`${moduleName} modülü başarıyla silindi!`);
}

// Veritabanı sil
// Veritabanı sil
function deleteDatabase(dbId) {
    const index = databases.findIndex(db => db.id === dbId);
    
    if (index === -1) return;
    
    const dbName = databases[index].name;
    
    // Silme işlemini onayla
    if (!confirm(`"${dbName}" veritabanını silmek istediğinizden emin misiniz?`)) {
        return;
    }
    
    // Veritabanını sil
    databases.splice(index, 1);
    
    // Listeleri güncelle
    refreshDatabasesList();
    
    alert(`${dbName} veritabanı başarıyla silindi!`);
 }
 
 // Servis sil
 function deleteService(serviceId) {
    const index = services.findIndex(s => s.id === serviceId);
    
    if (index === -1) return;
    
    const serviceName = services[index].name;
    
    // Silme işlemini onayla
    if (!confirm(`"${serviceName}" servisini silmek istediğinizden emin misiniz?`)) {
        return;
    }
    
    // Servisi sil
    services.splice(index, 1);
    
    // Listeleri güncelle
    refreshServicesList();
    
    alert(`${serviceName} servisi başarıyla silindi!`);
 }
 
 // Kuralları kaydet
 document.getElementById('saveRulesBtn').addEventListener('click', function() {
    const rulesText = document.getElementById('systemRules').value;
    rulesDocument = rulesText;
    
    alert('Kurallar başarıyla kaydedildi!');
    
    // Sohbet kutusu için de kuralları güncelle
    document.getElementById('rulesDocument').value = rulesText;
    document.getElementById('rulesStatus').textContent = "Kurallar kaydedildi!";
    document.getElementById('rulesStatus').style.color = "green";
 });
 
 // Kuralları indir
 document.getElementById('downloadRulesBtn').addEventListener('click', function() {
    const rulesText = document.getElementById('systemRules').value;
    
    // Dosya olarak indirme işlemi
    const blob = new Blob([rulesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cbot_kurallar.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
 });
 
 // Kuralları yükle düğmesini dinle
 document.getElementById('uploadRulesBtn').addEventListener('click', function() {
    document.getElementById('rulesFileInput').click();
 });
 
 // Kural dosyası seçildiğinde
 document.getElementById('rulesFileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        document.getElementById('systemRules').value = content;
        alert('Kurallar başarıyla yüklendi! Değişiklikleri kaydetmek için "Kuralları Kaydet" butonuna tıklayın.');
    };
    reader.readAsText(file);
 });
 
 // Admin paneline erişim
 document.getElementById('adminAccessBtn').addEventListener('click', function() {
    // Admin bölümüne kaydır
    const adminSection = document.getElementById('adminSection');
    adminSection.scrollIntoView({ behavior: 'smooth' });
    
    // Admin bölümünün görünürlüğünü vurgula
    adminSection.style.animation = 'highlight 2s';
    setTimeout(() => {
        adminSection.style.animation = '';
    }, 2000);
 });
 
 // Sayfanın başlangıcında veya yenilemede modül checkbox alanını güncelle
 document.addEventListener('DOMContentLoaded', function() {
    updateModuleCheckboxes();
    updateServiceCheckboxes();
 });
 
 // Demo sonuç oluşturan fonksiyon - Geliştirilmiş
 function generateDemoResult(data) {
    let result = `<h3>Seçilen Yapılandırma</h3>
    <p><strong>Ortam:</strong> ${data.environment === 'test' ? 'Test' : data.environment === 'prod' ? 'Canlı' : 'Test ve Canlı'}</p>
    <p><strong>Çalışma Ortamı:</strong> ${data.deploymentType === 'on-prem' ? 'On-Premise' : 'Bulut'}</p>
    <p><strong>Seçilen Modüller:</strong> ${data.modules.join(', ')}</p>
    <p><strong>Seçilen Yardımcı Servisler:</strong> ${data.services.length > 0 ? data.services.join(', ') : 'Yok'}</p>
    <p><strong>Veritabanı:</strong> ${data.dbType}</p>
    <p><strong>LDAP Kullanımı:</strong> ${data.ldapUsage === 'yes' ? 'Evet' : 'Hayır'}</p>
    
    <h3>Donanım Gereksinimleri</h3>
    <ul>`;
    
    // Tüm seçili modüller için donanım gereksinimlerini ekle
    for (const moduleId of data.modules) {
        const module = modules.find(m => m.id === moduleId);
        if (module) {
            result += `<li><strong>${module.name}:</strong> ${module.cpu} CPU, ${module.ram} RAM, ${module.disk} Disk</li>`;
        }
    }
    
    // Seçili servisler için gereksinim ekle
    for (const serviceId of data.services) {
        const service = services.find(s => s.id === serviceId);
        if (service) {
            result += `<li><strong>${service.name}:</strong> ${service.cpu} CPU, ${service.ram} RAM${service.requiresGPU ? ', <span style="color:blue">GPU gerektirir</span>' : ''}</li>`;
        }
    }
    
    result += `</ul>
    
    <h3>Veritabanı Gereksinimleri</h3>
    <ul>`;
    
    // Seçilen veritabanı için bilgiler
    const selectedDb = databases.find(db => db.id === data.dbType);
    if (selectedDb) {
        result += `
            <li><strong>Veritabanı Tipi:</strong> ${selectedDb.name}</li>
            <li><strong>Port:</strong> ${selectedDb.port}</li>
            <li><strong>Kullanıcı Yetkisi:</strong> OWNER yetkili olmalıdır</li>`;
            
        if (selectedDb.collation) {
            result += `<li><strong>Collation:</strong> ${selectedDb.collation}</li>`;
        }
    }
    
    result += `<li><strong>IP ve Port Paylaşımı:</strong> Zorunludur</li>
    </ul>
    
    <h3>Network / Firewall</h3>
    <ul>
        <li>Sunucular internet erişimli olmalıdır</li>
        <li>Veritabanı portları açık olmalıdır (default ${selectedDb ? selectedDb.port : 'default'})</li>
        <li>DNS kayıtları gereklidir:
            <ul>`;
    
    // Core ve Panel her zaman olduğundan bunlar için direkt ekle
    result += `
                <li>cbot-panel -> 3000</li>
                <li>cbot-core -> 5351</li>
                <li>cbot-socket -> 5000 (WebSocket)</li>`;
    
    // Diğer modüller için DNS kayıtları
    if (data.modules.includes('fusion')) {
        result += `<li>cbot-fusion -> 9600</li>`;
    }
    
    if (data.modules.includes('aiflow')) {
        result += `<li>cbot-aiflow -> 8080</li>`;
    }
    
    if (data.modules.includes('classifier')) {
        result += `<li>cbot-classifier -> 7700</li>`;
    }
    
    if (data.modules.includes('analytics')) {
        result += `<li>cbot-analytics -> 9090</li>`;
    }
    
    // Test ortamı eki bilgisi
    if (data.environment === 'test' || data.environment === 'both') {
        result += `<li>(test ortamları için sonuna -test eklenir)</li>`;
    }
    
    result += `
            </ul>
        </li>
        <li>Load Balancer 5000 portunda WebSocket desteklemelidir</li>
    </ul>
    
    <h3>Docker Image ve Registry</h3>
    <ul>
        <li>Tüm servis image'ları registry.cbot.ai adresinden çekilir</li>
        <li>Sunucular 443 portundan bu adrese erişebilmelidir</li>`;
    
    // On-premise ise ek bilgiler
    if (data.deploymentType === 'on-prem') {
        result += `
        <li>Kapalı ağda kurulum için:
            <ul>
                <li>Docker image'lar önceden indirilip yerel registry'ye yüklenmelidir</li>
                <li>Apt/yum bağımlılıkları için offline depolar yapılandırılmalıdır</li>
            </ul>
        </li>`;
    }
    
    result += `</ul>`;
    
    // LDAP bilgileri
    if (data.ldapUsage === 'yes') {
        result += `
        <h3>LDAP Gereksinimleri</h3>
        <ul>
            <li>LDAP_URL, BIND_DN, SEARCH_BASE, SEARCH_FILTER sağlanmalıdır</li>
            <li>Email, Role, Name field'ları mapping yapılmalıdır</li>
            <li>Rollerin panelde LDAP ile birebir eşleşmesi gerekir</li>
        </ul>`;
    }
    
    // AI Flow varsa ek gereksinimler ekle
    if (data.modules.includes('aiflow')) {
        const aiflow = modules.find(m => m.id === 'aiflow');
        result += `
        <h3>AI Flow Ek Gereksinimleri</h3>
        <ul>
            <li>Minimum ${aiflow ? aiflow.cpu : '10 Core'} CPU, ${aiflow ? aiflow.ram : '8 GB RAM'}</li>`;
        
        // PostgreSQL AI Flow için önerilir
        if (data.dbType === 'postgresql') {
            result += `<li>PostgreSQL için 4 GB disk alanı ayrılmalıdır</li>`;
        } else {
            result += `<li>AI Flow en iyi PostgreSQL ile çalışır, mevcut seçiminiz: ${data.dbType}</li>`;
        }
        
        result += `</ul>`;
    }
    
    // HF Model hosting varsa ek gereksinimler
    if (data.services.includes('hfModel')) {
        result += `
        <h3>HF Model Hosting Ek Gereksinimleri</h3>
        <ul>
            <li>En az 1 adet NVIDIA GPU (minimum 16 GB VRAM)</li>
            <li>CUDA 11.1 veya üstü</li>
            <li>GPU driver sürümü 450.x ve üstü</li>
        </ul>`;
    }
    
    // Demo notu
    result += `
    <div style="margin-top: 30px; padding: 15px; background-color: #f8f9fa; border-radius: 5px; font-style: italic;">
        <p><strong>Not:</strong> Bu doküman seçimlerinize göre oluşturulmuştur. Detaylar için lütfen teknik ekiple iletişime geçin.</p>
    </div>
    `;
    
    return result;
 }




 //eklemeler1
 // Uyumluluk kuralları tanımlama
const compatibilityRules = {
    modules: {
        aiflow: {
            databases: ['postgresql'], // AI Flow en iyi PostgreSQL ile çalışır
            incompatibleWith: []
        },
        classifier: {
            databases: ['mssql'], // Classifier sadece MSSQL ile çalışır
            incompatibleWith: []
        },
        fusion: {
            databases: ['postgresql', 'mssql'], // Fusion her iki veritabanıyla da çalışabilir
            incompatibleWith: []
        },
        analytics: {
            databases: ['mongodb'], // Analytics MongoDB ile çalışır
            incompatibleWith: []
        },
        livechat: {
            databases: [], // LiveChat veritabanına doğrudan bağlanmaz
            incompatibleWith: []
        }
    },
    services: {
        masking: {
            requiresModules: ['fusion', 'aiflow'], // Maskeleme servisi Fusion veya AI Flow modüllerinden birini gerektirir
            incompatibleWith: []
        },
        hfModel: {
            requiresGPU: true, // HF Model Hosting GPU gerektirir
            incompatibleWith: []
        }
    }
};

// Uyumluluk kontrolü fonksiyonu
function checkCompatibility() {
    const selectedModules = Array.from(document.querySelectorAll('input[name="modules"]:checked')).map(cb => cb.value);
    const selectedServices = Array.from(document.querySelectorAll('input[name="services"]:checked')).map(cb => cb.value);
    const selectedDB = document.getElementById('dbType').value;
    
    let warnings = [];
    
    // Modül-veritabanı uyumluluk kontrolü
    selectedModules.forEach(module => {
        if (compatibilityRules.modules[module] && 
            compatibilityRules.modules[module].databases.length > 0 && 
            !compatibilityRules.modules[module].databases.includes(selectedDB)) {
            warnings.push(`<strong>${module.toUpperCase()}</strong> modülü <strong>${selectedDB.toUpperCase()}</strong> veritabanı ile optimal çalışmaz. Önerilen: ${compatibilityRules.modules[module].databases.join(', ').toUpperCase()}`);
        }
    });
    
    // Servis-modül bağımlılık kontrolü
    selectedServices.forEach(service => {
        if (compatibilityRules.services[service] && 
            compatibilityRules.services[service].requiresModules) {
            
            const hasRequiredModule = compatibilityRules.services[service].requiresModules.some(
                reqModule => selectedModules.includes(reqModule)
            );
            
            if (!hasRequiredModule) {
                warnings.push(`<strong>${service.toUpperCase()}</strong> servisi için ${compatibilityRules.services[service].requiresModules.join(' veya ')} modüllerinden en az biri gereklidir.`);
            }
        }
    });
    
    // GPU gerektiren servisler kontrolü
    const requiresGPU = selectedServices.some(service => 
        compatibilityRules.services[service] && 
        compatibilityRules.services[service].requiresGPU
    );
    
    if (requiresGPU) {
        warnings.push("<strong>DİKKAT:</strong> Seçilen servislerden en az biri GPU gerektirir. En az 1 adet NVIDIA GPU (min. 16 GB VRAM) olmalıdır.");
    }
    
    return warnings;
}

// Uyumluluk uyarılarını gösterme/güncelleme 
function updateCompatibilityWarnings() {
    // Eski uyarıları temizle
    const existingWarnings = document.getElementById('compatibilityWarnings');
    if (existingWarnings) {
        existingWarnings.remove();
    }
    
    // Uyarıları kontrol et
    const warnings = checkCompatibility();
    
    if (warnings.length > 0) {
        // Uyarı alanı oluştur
        const warningsContainer = document.createElement('div');
        warningsContainer.id = 'compatibilityWarnings';
        warningsContainer.className = 'compatibility-warnings';
        
        const warningsTitle = document.createElement('h3');
        warningsTitle.innerHTML = '⚠️ Uyumluluk Uyarıları';
        warningsContainer.appendChild(warningsTitle);
        
        const warningsList = document.createElement('ul');
        warnings.forEach(warning => {
            const warningItem = document.createElement('li');
            warningItem.innerHTML = warning;
            warningsList.appendChild(warningItem);
        });
        
        warningsContainer.appendChild(warningsList);
        
        // Form'dan sonra uyarıları ekle
        const formElement = document.getElementById('requirementForm');
        formElement.after(warningsContainer);
    }
}


// Form değişikliklerinde uyumluluk kontrolü
function setupCompatibilityChecks() {
    // Tüm modül checkbox'ları
    document.querySelectorAll('input[name="modules"]').forEach(checkbox => {
        checkbox.addEventListener('change', updateCompatibilityWarnings);
    });
    
    // Tüm servis checkbox'ları
    document.querySelectorAll('input[name="services"]').forEach(checkbox => {
        checkbox.addEventListener('change', updateCompatibilityWarnings);
    });
    
    // Veritabanı seçimi
    document.getElementById('dbType').addEventListener('change', updateCompatibilityWarnings);
}

// Sayfa yüklendiğinde uyumluluk kontrollerini etkinleştir
document.addEventListener('DOMContentLoaded', function() {
    updateModuleCheckboxes();
    updateServiceCheckboxes();
    setupCompatibilityChecks();
    updateCompatibilityWarnings();
});


// Özel kurallar için veri yapısı
let customRules = [];

// Kural tipine göre seçim listelerini güncelleme
function updateRuleSelectors() {
    const conditionType = document.getElementById('ruleConditionType').value;
    const conditionValueSelect = document.getElementById('ruleConditionValue');
    
    // Koşul değerlerini güncelle
    conditionValueSelect.innerHTML = '';
    
    if (conditionType === 'module') {
        modules.forEach(module => {
            const option = document.createElement('option');
            option.value = module.id;
            option.textContent = module.name;
            conditionValueSelect.appendChild(option);
        });
    } 
    else if (conditionType === 'service') {
        services.forEach(service => {
            const option = document.createElement('option');
            option.value = service.id;
            option.textContent = service.name;
            conditionValueSelect.appendChild(option);
        });
    }
    else if (conditionType === 'database') {
        databases.forEach(db => {
            const option = document.createElement('option');
            option.value = db.id;
            option.textContent = db.name;
            conditionValueSelect.appendChild(option);
        });
    }
    
    // Hedef değerlerini de güncelle
    updateRuleTargetSelector();
}

// Hedef seçicileri güncelleme
function updateRuleTargetSelector() {
    const targetType = document.getElementById('ruleTargetType').value;
    const actionType = document.getElementById('ruleActionType').value;
    const targetValueSelect = document.getElementById('ruleTargetValue');
    const targetContainer = document.getElementById('ruleTargetContainer');
    const messageContainer = document.getElementById('ruleMessageContainer');
    
    // Aksiyon tipine göre görünüm ayarla
    if (actionType === 'warn') {
        targetContainer.style.display = 'none';
        messageContainer.style.display = 'inline-block';
    } else {
        targetContainer.style.display = 'inline-block';
        messageContainer.style.display = 'none';
        
        // Hedef değerlerini güncelle
        targetValueSelect.innerHTML = '';
        
        if (targetType === 'module') {
            modules.forEach(module => {
                const option = document.createElement('option');
                option.value = module.id;
                option.textContent = module.name;
                targetValueSelect.appendChild(option);
            });
        } 
        else if (targetType === 'service') {
            services.forEach(service => {
                const option = document.createElement('option');
                option.value = service.id;
                option.textContent = service.name;
                targetValueSelect.appendChild(option);
            });
        }
        else if (targetType === 'database') {
            databases.forEach(db => {
                const option = document.createElement('option');
                option.value = db.id;
                option.textContent = db.name;
                targetValueSelect.appendChild(option);
            });
        }
    }
}

// Kural ekle butonu işlevi
function addCustomRule() {
    const conditionType = document.getElementById('ruleConditionType').value;
    const conditionOperator = document.getElementById('ruleConditionOperator').value;
    const conditionValue = document.getElementById('ruleConditionValue').value;
    const actionType = document.getElementById('ruleActionType').value;
    
    let targetType = null;
    let targetValue = null;
    let warningMessage = null;
    
    if (actionType === 'warn') {
        warningMessage = document.getElementById('ruleWarningMessage').value;
        if (!warningMessage) {
            alert('Lütfen bir uyarı mesajı girin!');
            return;
        }
    } else {
        targetType = document.getElementById('ruleTargetType').value;
        targetValue = document.getElementById('ruleTargetValue').value;
    }
    
    // Yeni kural oluştur
    const newRule = {
        id: Date.now().toString(),
        condition: {
            type: conditionType,
            operator: conditionOperator,
            value: conditionValue
        },
        action: {
            type: actionType,
            targetType: targetType,
            targetValue: targetValue,
            message: warningMessage
        }
    };
    
    // Kuralı ekle
    customRules.push(newRule);
    
    // Kural listesini güncelle
    refreshCustomRulesList();
    
    // Kuralları string formatında sistem kurallarına ekle ve kaydet
    updateSystemRulesFromCustomRules();
}

// Kuralları metin formatına dönüştürme
function updateSystemRulesFromCustomRules() {
    let rulesText = document.getElementById('systemRules').value;
    
    // Özel kurallar bölümünü temizle
    rulesText = rulesText.replace(/--- ÖZEL KURALLAR BAŞLANGIÇ ---[\s\S]*--- ÖZEL KURALLAR BİTİŞ ---/g, '');
    
    // Özel kurallar yoksa bir şey yapma
    if (customRules.length === 0) {
        document.getElementById('systemRules').value = rulesText;
        return;
    }
    
    // Özel kuralları metin formatında hazırla
    let customRulesText = "\n\n--- ÖZEL KURALLAR BAŞLANGIÇ ---\n";
    
    customRules.forEach(rule => {
        // Koşul bölümü
        let conditionText = `EĞER ${rule.condition.type} "${getNameById(rule.condition.type, rule.condition.value)}" `;
        conditionText += rule.condition.operator === 'selected' ? 'seçilirse' : 'seçilmezse';
        
        // Aksiyon bölümü
        let actionText = '';
        if (rule.action.type === 'warn') {
            actionText = `UYARI: ${rule.action.message}`;
        } else if (rule.action.type === 'require') {
            actionText = `ZORUNLU: ${rule.action.targetType} "${getNameById(rule.action.targetType, rule.action.targetValue)}"`;
        } else if (rule.action.type === 'disable') {
            actionText = `DEVRE DIŞI BIRAK: ${rule.action.targetType} "${getNameById(rule.action.targetType, rule.action.targetValue)}"`;
        }
        
        customRulesText += `\n* ${conditionText} -> ${actionText}`;
    });
    
    customRulesText += "\n--- ÖZEL KURALLAR BİTİŞ ---";
    
    // Metin alanına ekle
    document.getElementById('systemRules').value = rulesText + customRulesText;
    
    // Kuralları kaydet
    saveRules();
}

// ID'ye göre isim bulma
function getNameById(type, id) {
    if (type === 'module') {
        const module = modules.find(m => m.id === id);
        return module ? module.name : id;
    } 
    else if (type === 'service') {
        const service = services.find(s => s.id === id);
        return service ? service.name : id;
    }
    else if (type === 'database') {
        const db = databases.find(d => d.id === id);
        return db ? db.name : id;
    }
    return id;
}

// Kural listesini güncelleme
function refreshCustomRulesList() {
    const customRulesList = document.getElementById('customRulesList');
    customRulesList.innerHTML = '';
    
    if (customRules.length === 0) {
        customRulesList.innerHTML = '<p>Henüz özel kural tanımlanmamış.</p>';
        return;
    }
    
    customRules.forEach(rule => {
        const ruleElement = document.createElement('div');
        ruleElement.className = 'custom-rule-item';
        
        // Koşul metni
        let conditionText = `EĞER ${rule.condition.type} "${getNameById(rule.condition.type, rule.condition.value)}" `;
        conditionText += rule.condition.operator === 'selected' ? 'seçilirse' : 'seçilmezse';
        
        // Aksiyon metni
        let actionText = '';
        if (rule.action.type === 'warn') {
            actionText = `UYARI: ${rule.action.message}`;
        } else if (rule.action.type === 'require') {
            actionText = `ZORUNLU: ${rule.action.targetType} "${getNameById(rule.action.targetType, rule.action.targetValue)}"`;
        } else if (rule.action.type === 'disable') {
            actionText = `DEVRE DIŞI BIRAK: ${rule.action.targetType} "${getNameById(rule.action.targetType, rule.action.targetValue)}"`;
        }
        
        ruleElement.innerHTML = `
            <div class="rule-content">
                <div class="rule-text">${conditionText} -> ${actionText}</div>
                <button class="delete-rule-btn" data-id="${rule.id}">Sil</button>
            </div>
        `;
        
        customRulesList.appendChild(ruleElement);
    });
    
    // Silme butonlarına event listener ekle
    document.querySelectorAll('.delete-rule-btn').forEach(button => {
        button.addEventListener('click', function() {
            const ruleId = this.getAttribute('data-id');
            deleteCustomRule(ruleId);
        });
    });
}

// Kural silme
function deleteCustomRule(ruleId) {
    const index = customRules.findIndex(rule => rule.id === ruleId);
    
    if (index !== -1) {
        customRules.splice(index, 1);
        refreshCustomRulesList();
        updateSystemRulesFromCustomRules();
    }
}

// Metin ve görsel kural sekmeleri
function setupRuleTabs() {
    document.querySelectorAll('.rule-tab-btn').forEach(button => {
        button.addEventListener('click', function() {
            // Tüm sekme butonlarını pasif yap
            document.querySelectorAll('.rule-tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Tüm sekme içeriklerini gizle
            document.querySelectorAll('.rule-content').forEach(content => {
                content.style.display = 'none';
            });
            
            // Seçilen sekme butonunu aktif yap
            this.classList.add('active');
            
            // Seçilen sekme içeriğini göster
            const ruleType = this.getAttribute('data-ruletype');
            if (ruleType === 'text') {
                document.getElementById('textRuleContent').style.display = 'block';
            } else {
                document.getElementById('visualRuleContent').style.display = 'block';
            }
        });
    });
}


// Sistem mimarisi görselleştirme
function generateSystemDiagram() {
    const systemDiagram = document.getElementById('systemDiagram');
    systemDiagram.innerHTML = '';
    
    // Seçilen bileşenleri al
    const selectedModules = Array.from(document.querySelectorAll('input[name="modules"]:checked')).map(cb => cb.value);
    const selectedServices = Array.from(document.querySelectorAll('input[name="services"]:checked')).map(cb => cb.value);
    const selectedDB = document.getElementById('dbType').value;
    
    // SVG container oluştur
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "500");
    svg.setAttribute("viewBox", "0 0 1000 500");
    
    // Stil tanımlamaları
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    
    // Modül renk tanımı
    const moduleColor = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
    moduleColor.setAttribute("id", "moduleGradient");
    moduleColor.innerHTML = `
        <stop offset="0%" stop-color="#4F94CD" />
        <stop offset="100%" stop-color="#3A6EA5" />
    `;
    
    // Servis renk tanımı
    const serviceColor = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
    serviceColor.setAttribute("id", "serviceGradient");
    serviceColor.innerHTML = `
        <stop offset="0%" stop-color="#5CB85C" />
        <stop offset="100%" stop-color="#449D44" />
    `;
    
    // Veritabanı renk tanımı
    const dbColor = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
    dbColor.setAttribute("id", "dbGradient");
    dbColor.innerHTML = `
        <stop offset="0%" stop-color="#F0AD4E" />
        <stop offset="100%" stop-color="#EC971F" />
    `;
    
    defs.appendChild(moduleColor);
    defs.appendChild(serviceColor);
    defs.appendChild(dbColor);
    svg.appendChild(defs);
    
    // Merkez pozisyonu
    const centerX = 500;
    const centerY = 250;
    
    // Bağlantı çizgilerini çiz (zeminede olmalı)
    const connectionsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    
    // Veritabanı bağlantıları
    const db = databases.find(d => d.id === selectedDB);
    
    if (db) {
        selectedModules.forEach((moduleId, index) => {
            const module = modules.find(m => m.id === moduleId);
            if (module) {
                // Bu modül seçilen veritabanıyla uyumlu mu kontrol et
                const isCompatible = !compatibilityRules.modules[moduleId] ||
                                    !compatibilityRules.modules[moduleId].databases.length ||
                                    compatibilityRules.modules[moduleId].databases.includes(selectedDB);
                
                // Modül açısı hesapla
                const angle = (2 * Math.PI * index) / selectedModules.length;
                const moduleX = centerX + 200 * Math.cos(angle);
                const moduleY = centerY + 200 * Math.sin(angle);
                
                // Veritabanı ile modül arasına çizgi çek
                const connection = document.createElementNS("http://www.w3.org/2000/svg", "line");
                connection.setAttribute("x1", centerX);
                connection.setAttribute("y1", centerY);
                connection.setAttribute("x2", moduleX);
                connection.setAttribute("y2", moduleY);
                connection.setAttribute("stroke", isCompatible ? "#999" : "#ff3333");
                connection.setAttribute("stroke-width", "2");
                connection.setAttribute("stroke-dasharray", isCompatible ? "" : "5,5");
                
                connectionsGroup.appendChild(connection);
            }
        });
    }
    
    // Modüller ve servisler arasındaki

    // Modüller ve servisler arasındaki bağlantılar
selectedServices.forEach((serviceId, index) => {
    const service = services.find(s => s.id === serviceId);
    if (service) {
        // Servis pozisyonunu hesapla (dış çemberde)
        const angle = (2 * Math.PI * index) / selectedServices.length;
        const serviceX = centerX + 300 * Math.cos(angle);
        const serviceY = centerY + 300 * Math.sin(angle);
        
        // Servis bağımlılıklarını kontrol et
        if (compatibilityRules.services[serviceId] && 
            compatibilityRules.services[serviceId].requiresModules) {
            
            const requiredModules = compatibilityRules.services[serviceId].requiresModules;
            let hasConnection = false;
            
            // Seçili modüllerden herhangi biri bu servise bağlı mı kontrol et
            selectedModules.forEach((moduleId, moduleIndex) => {
                if (requiredModules.includes(moduleId)) {
                    hasConnection = true;
                    
                    // Modül pozisyonunu hesapla
                    const moduleAngle = (2 * Math.PI * moduleIndex) / selectedModules.length;
                    const moduleX = centerX + 200 * Math.cos(moduleAngle);
                    const moduleY = centerY + 200 * Math.sin(moduleAngle);
                    
                    // Modül ile servis arasına çizgi çek
                    const connection = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    connection.setAttribute("x1", moduleX);
                    connection.setAttribute("y1", moduleY);
                    connection.setAttribute("x2", serviceX);
                    connection.setAttribute("y2", serviceY);
                    connection.setAttribute("stroke", "#666");
                    connection.setAttribute("stroke-width", "2");
                    
                    connectionsGroup.appendChild(connection);
                }
            });
            
            // Bağımlı modül seçilmemişse kırmızı kesikli çizgi ile göster
            if (!hasConnection) {
                // En yakın modüle bağlantı göster
                if (selectedModules.length > 0) {
                    const firstModuleIndex = 0;
                    const moduleAngle = (2 * Math.PI * firstModuleIndex) / selectedModules.length;
                    const moduleX = centerX + 200 * Math.cos(moduleAngle);
                    const moduleY = centerY + 200 * Math.sin(moduleAngle);
                    
                    const connection = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    connection.setAttribute("x1", moduleX);
                    connection.setAttribute("y1", moduleY);
                    connection.setAttribute("x2", serviceX);
                    connection.setAttribute("y2", serviceY);
                    connection.setAttribute("stroke", "#ff3333");
                    connection.setAttribute("stroke-width", "2");
                    connection.setAttribute("stroke-dasharray", "5,5");
                    
                    connectionsGroup.appendChild(connection);
                }
            }
        }
    }
});

svg.appendChild(connectionsGroup);

// Veritabanı yerleştir (merkeze)
if (db) {
    const dbGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    
    // Veritabanı sembölü
    const dbIcon = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    dbIcon.setAttribute("x", centerX - 40);
    dbIcon.setAttribute("y", centerY - 25);
    dbIcon.setAttribute("width", 80);
    dbIcon.setAttribute("height", 50);
    dbIcon.setAttribute("rx", 10);
    dbIcon.setAttribute("fill", "url(#dbGradient)");
    dbIcon.setAttribute("stroke", "#000");
    dbIcon.setAttribute("stroke-width", "1");
    
    // Veritabanı ismi
    const dbText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    dbText.setAttribute("x", centerX);
    dbText.setAttribute("y", centerY + 5);
    dbText.setAttribute("text-anchor", "middle");
    dbText.setAttribute("font-size", "14");
    dbText.setAttribute("fill", "#fff");
    dbText.textContent = db.name;
    
    dbGroup.appendChild(dbIcon);
    dbGroup.appendChild(dbText);
    svg.appendChild(dbGroup);
}

// Modülleri yerleştir (orta çembere)
selectedModules.forEach((moduleId, index) => {
    const module = modules.find(m => m.id === moduleId);
    if (module) {
        const angle = (2 * Math.PI * index) / selectedModules.length;
        const x = centerX + 200 * Math.cos(angle);
        const y = centerY + 200 * Math.sin(angle);
        
        const moduleGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        
        // Modül kutusu
        const moduleIcon = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        moduleIcon.setAttribute("x", x - 45);
        moduleIcon.setAttribute("y", y - 20);
        moduleIcon.setAttribute("width", 90);
        moduleIcon.setAttribute("height", 40);
        moduleIcon.setAttribute("rx", 5);
        moduleIcon.setAttribute("fill", "url(#moduleGradient)");
        moduleIcon.setAttribute("stroke", "#000");
        moduleIcon.setAttribute("stroke-width", "1");
        
        // Modül ismi
        const moduleText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        moduleText.setAttribute("x", x);
        moduleText.setAttribute("y", y + 5);
        moduleText.setAttribute("text-anchor", "middle");
        moduleText.setAttribute("font-size", "12");
        moduleText.setAttribute("fill", "#fff");
        moduleText.textContent = module.name;
        
        moduleGroup.appendChild(moduleIcon);
        moduleGroup.appendChild(moduleText);
        svg.appendChild(moduleGroup);
    }
});

// Servisleri yerleştir (dış çembere)
selectedServices.forEach((serviceId, index) => {
    const service = services.find(s => s.id === serviceId);
    if (service) {
        const angle = (2 * Math.PI * index) / selectedServices.length;
        const x = centerX + 300 * Math.cos(angle);
        const y = centerY + 300 * Math.sin(angle);
        
        const serviceGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        
        // Servis kutusu
        const serviceIcon = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        serviceIcon.setAttribute("x", x - 45);
        serviceIcon.setAttribute("y", y - 20);
        serviceIcon.setAttribute("width", 90);
        serviceIcon.setAttribute("height", 40);
        serviceIcon.setAttribute("rx", 5);
        serviceIcon.setAttribute("fill", "url(#serviceGradient)");
        serviceIcon.setAttribute("stroke", "#000");
        serviceIcon.setAttribute("stroke-width", "1");
        
        // GPU gereksinimi için özel gösterge
        if (service.requiresGPU) {
            const gpuIndicator = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            gpuIndicator.setAttribute("cx", x + 35);
            gpuIndicator.setAttribute("cy", y - 15);
            gpuIndicator.setAttribute("r", 5);
            gpuIndicator.setAttribute("fill", "#ff9900");
            serviceGroup.appendChild(gpuIndicator);
        }
        
        // Servis ismi
        const serviceText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        serviceText.setAttribute("x", x);
        serviceText.setAttribute("y", y + 5);
        serviceText.setAttribute("text-anchor", "middle");
        serviceText.setAttribute("font-size", "12");
        serviceText.setAttribute("fill", "#fff");
        serviceText.textContent = service.name;
        
        serviceGroup.appendChild(serviceIcon);
        serviceGroup.appendChild(serviceText);
        svg.appendChild(serviceGroup);
    }
});

systemDiagram.appendChild(svg);
}

// Sonuç sekmelerini ayarla
function setupResultTabs() {
    document.querySelectorAll('.result-tab-btn').forEach(button => {
        button.addEventListener('click', function() {
            // Tüm sekme butonlarını pasif yap
            document.querySelectorAll('.result-tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Tüm sekme içeriklerini gizle
            document.querySelectorAll('.result-content').forEach(content => {
                content.style.display = 'none';
            });
            
            // Seçilen sekme butonunu aktif yap
            this.classList.add('active');
            
            // Seçilen sekme içeriğini göster
            const resultType = this.getAttribute('data-result');
            if (resultType === 'text') {
                document.getElementById('textResultContent').style.display = 'block';
            } else {
                document.getElementById('diagramResultContent').style.display = 'block';
                generateSystemDiagram(); // Diyagramı oluştur
            }
        });
    });
}

// Sayfa yüklendiğinde yapılacak işlemler
document.addEventListener('DOMContentLoaded', function() {
    // Mevcut form elemanlarını güncelle
    updateModuleCheckboxes();
    updateServiceCheckboxes();
    
    // Uyumluluk kontrollerini etkinleştir
    setupCompatibilityChecks();
    updateCompatibilityWarnings();
    
    // Kural oluşturma sistemi için event listener'ları ayarla
    setupRuleTabs();
    
    // Kural seçicilerini güncelle
    document.getElementById('ruleConditionType').addEventListener('change', updateRuleSelectors);
    document.getElementById('ruleTargetType').addEventListener('change', updateRuleTargetSelector);
    document.getElementById('ruleActionType').addEventListener('change', updateRuleTargetSelector);
    
    // Kural ekleme butonu
    document.getElementById('addRuleBtn').addEventListener('click', addCustomRule);
    
    // Kural seçicilerini ilk yükleme
    updateRuleSelectors();
    
    // Sonuç sekmelerini ayarla
    setupResultTabs();
    
    // Form gönderildiğinde uyumluluk kontrolünü yap
    document.getElementById('requirementForm').addEventListener('submit', function(e) {
        // Mevcut gönderme işlevini çalıştırmadan önce
        const warnings = checkCompatibility();
        
        if (warnings.length > 0) {
            const confirmSubmit = confirm("Uyumluluk uyarıları var. Yine de devam etmek istiyor musunuz?");
            if (!confirmSubmit) {
                e.preventDefault();
                return false;
            }
        }
    });
});