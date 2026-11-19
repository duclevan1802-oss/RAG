from zipfile import ZipFile, ZIP_DEFLATED
from xml.sax.saxutils import escape
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'bao-cao-tien-do-VIT-AI-dep.pptx'
slides = [
 ('BÁO CÁO TIẾN ĐỘ DỰ ÁN', 'VIT AI\nHệ thống hỏi đáp tài liệu RAG', ['Trợ lý tìm kiếm và hỏi đáp trên tài liệu riêng', 'FastAPI  •  React  •  MongoDB Atlas  •  Qwen3:4b']),
 ('01  /  MỤC TIÊU', 'Xây dựng trợ lý dựa trên tài liệu riêng', ['Kho tài liệu: tạo bộ, tải lên và quản lý file.', 'Hỏi đáp tiếng Việt: tìm đoạn liên quan và gửi ngữ cảnh cho Qwen.', 'Nguồn tham khảo: hiển thị tên file, đoạn trích và số trang khi có.']),
 ('02  /  CÔNG NGHỆ', 'Các thành phần chính', ['Giao diện: React và TypeScript; API: Python và FastAPI.', 'Mô hình: Qwen3:4b chạy qua Ollama; embedding: Sentence Transformers.', 'Lưu trữ: MongoDB Atlas / GridFS lưu file gốc, ChromaDB local lưu vector.', 'Phân tích tài liệu: PyMuPDF cho PDF, python-docx cho DOCX.']),
 ('03  /  XỬ LÝ DỮ LIỆU', 'Luồng tải và xử lý tài liệu', ['1. Chọn bộ tài liệu và tải file PDF hoặc DOCX.', '2. Lưu file gốc trên MongoDB Atlas.', '3. Đọc nội dung, chia đoạn, tạo embedding.', '4. Lưu vector và metadata vào ChromaDB; cập nhật trạng thái file.', 'Có API xử lý lại tài liệu khi cần.']),
 ('04  /  RAG', 'Luồng hỏi đáp theo tài liệu', ['Câu hỏi → tạo embedding → tìm đoạn liên quan trong ChromaDB.', 'Kiểm tra file nguồn còn tồn tại và có trạng thái sẵn sàng.', 'Ghép câu hỏi với các đoạn tìm được, gửi cho Qwen qua Ollama.', 'Trả lời kèm các đoạn nguồn; hỗ trợ lọc theo bộ tài liệu.', 'Chế độ tìm tất cả bộ đã bổ sung trong code, cần kiểm thử đầu cuối.']),
 ('05  /  TIẾN ĐỘ', 'Những phần đã triển khai', ['Backend: kết nối Atlas, ChromaDB, Ollama; API bộ tài liệu và file.', 'Xử lý PDF / DOCX: đọc văn bản, chia đoạn, tạo và lưu embedding.', 'Hỏi đáp: API chat và chat RAG, nguồn kèm tên file và số trang.', 'Frontend: hiển thị bộ/file, tạo bộ, tải lên, xóa, hỏi đáp và xem nguồn.', 'Frontend đã build thành công.']),
 ('06  /  KIỂM THỬ', 'Kết quả và giới hạn hiện tại', ['Đã thử hỏi “RAG là gì?” qua API và giao diện, nhận câu trả lời kèm nguồn.', 'Chưa triển khai OCR và hỏi đáp trực tiếp từ ảnh.', 'Lịch sử chat chưa được lưu trong MongoDB.', 'Chất lượng tìm kiếm và dẫn nguồn cần đánh giá thêm.', 'Chế độ tìm tất cả bộ tài liệu cần kiểm thử thực tế.']),
 ('07  /  KẾ HOẠCH', 'Các bước tiếp theo', ['Kiểm thử toàn bộ luồng tải file, truy xuất và xử lý lỗi.', 'Cải thiện giao diện chat: trạng thái chờ và lưu lịch sử.', 'Triển khai OCR, hỗ trợ ảnh và tài liệu scan.', 'Đánh giá độ liên quan của kết quả tìm kiếm và chất lượng câu trả lời.']),
]
ns='http://schemas.openxmlformats.org/'
def sh(n,x,y,w,h,text,size,color='17365F',bold=False):
    paras=''.join(f'<a:p><a:pPr/><a:r><a:rPr lang="vi-VN" sz="{size}" b="{int(bold)}"><a:solidFill><a:srgbClr val="{color}"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>{escape(line)}</a:t></a:r><a:endParaRPr lang="vi-VN"/></a:p>' for line in text.split('\n'))
    return f'<p:sp><p:nvSpPr><p:cNvPr id="{n}" name="Text {n}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>{paras}</p:txBody></p:sp>'
def rect(n,x,y,w,h,fill,rounded=False):
    geom='roundRect' if rounded else 'rect'
    return f'<p:sp><p:nvSpPr><p:cNvPr id="{n}" name="Shape {n}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/></a:xfrm><a:prstGeom prst="{geom}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="{fill}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>'

def slide(i, item):
    kicker,title,lines=item; dark=i==1; bg='102E58' if dark else 'F7FAFF'; fg='FFFFFF' if dark else '15335B'; sub='D9EBFF' if dark else '304F74'
    parts=[rect(60,0,0,160000,6858000,'42A5F5' if dark else '2870C6'), rect(61,9800000,0,2392000,180000,'368AE0')]
    parts.extend([sh(2,720000,440000,10400000,420000,kicker,1400,'7EC8FF' if dark else '2870C6',True),sh(3,700000,1000000,10800000,1280000,title,3600 if dark else 2800,fg,True)])
    if dark:
        parts.append(rect(62,720000,2880000,1500000,55000,'54B4FF'))
        for j,line in enumerate(lines):
            parts.append(sh(10+j,720000,3200000+j*850000,10000000,600000,line,2100,'D9EBFF'))
    elif i in (4,5):
        for j,line in enumerate(lines[:4]):
            x=700000+j*2770000
            parts.append(rect(70+j,x,2400000,2580000,2300000,'FFFFFF',True))
            parts.append(rect(80+j,x,2400000,2580000,90000,'3489DC'))
            parts.append(sh(90+j,x+170000,2590000,700000,450000,f'{j+1:02}',2100,'2870C6',True))
            parts.append(sh(100+j,x+140000,3180000,2300000,1250000,line,1500,'304F74'))
        parts.append(sh(110,750000,5100000,10600000,500000,lines[4],1400,'597592'))
    else:
        for j,line in enumerate(lines):
            col=j%2; row=j//2; x=700000+col*5500000; y=2270000+row*1220000
            parts.append(rect(70+j,x,y,5200000,1020000,'FFFFFF',True))
            parts.append(rect(80+j,x,y,70000,1020000,'4D9BE8'))
            parts.append(sh(90+j,x+160000,y+100000,4750000,820000,line,1650,'304F74'))
    parts.append(sh(50,650000,6320000,10000000,250000,'VIT AI  |  Báo cáo tiến độ',1000,'ADC6E4' if dark else '728AA7'))
    parts.append(sh(51,11200000,6320000,350000,250000,f'{i:02}',1000,'ADC6E4' if dark else '728AA7'))
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="{ns}drawingml/2006/main" xmlns:r="{ns}officeDocument/2006/relationships" xmlns:p="{ns}presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="{bg}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>{''.join(parts)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'''
rels='http://schemas.openxmlformats.org/package/2006/relationships'
def rel(items): return f'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="{rels}">'+''.join(f'<Relationship Id="{i}" Type="{ns}officeDocument/2006/relationships/{typ}" Target="{target}"/>' for i,typ,target in items)+'</Relationships>'
empty_tree='<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
hdr=f'xmlns:a="{ns}drawingml/2006/main" xmlns:r="{ns}officeDocument/2006/relationships" xmlns:p="{ns}presentationml/2006/main"'
with ZipFile(OUT,'w',ZIP_DEFLATED) as z:
    overrides=''.join(f'<Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>' for i in range(1,len(slides)+1))
    z.writestr('[Content_Types].xml',f'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>{overrides}</Types>')
    z.writestr('_rels/.rels',rel([('rId1','officeDocument','ppt/presentation.xml')]))
    slideids=''.join(f'<p:sldId id="{255+i}" r:id="rId{i+1}"/>' for i in range(1,len(slides)+1))
    z.writestr('ppt/presentation.xml',f'<?xml version="1.0" encoding="UTF-8"?><p:presentation {hdr}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>{slideids}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>')
    z.writestr('ppt/_rels/presentation.xml.rels',rel([('rId1','slideMaster','slideMasters/slideMaster1.xml')]+[(f'rId{i+1}','slide',f'slides/slide{i}.xml') for i in range(1,len(slides)+1)]))
    z.writestr('ppt/slideMasters/slideMaster1.xml',f'<?xml version="1.0" encoding="UTF-8"?><p:sldMaster {hdr}><p:cSld><p:spTree>{empty_tree}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>')
    z.writestr('ppt/slideMasters/_rels/slideMaster1.xml.rels',rel([('rId1','slideLayout','../slideLayouts/slideLayout1.xml'),('rId2','theme','../theme/theme1.xml')]))
    z.writestr('ppt/slideLayouts/slideLayout1.xml',f'<?xml version="1.0" encoding="UTF-8"?><p:sldLayout {hdr} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>{empty_tree}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>')
    z.writestr('ppt/slideLayouts/_rels/slideLayout1.xml.rels',rel([('rId1','slideMaster','../slideMasters/slideMaster1.xml')]))
    colors=['000000','FFFFFF','17365F','E7EFFA','2870C6','4A91DC','76B1E8','A1C9EF','2D5E91','7B9ABD','0563C1','954F72']; names=['dk1','lt1','dk2','lt2','accent1','accent2','accent3','accent4','accent5','accent6','hlink','folHlink']
    scheme=''.join(f'<a:{n}><a:srgbClr val="{v}"/></a:{n}>' for n,v in zip(names,colors))
    z.writestr('ppt/theme/theme1.xml',f'<?xml version="1.0" encoding="UTF-8"?><a:theme xmlns:a="{ns}drawingml/2006/main" name="VIT AI"><a:themeElements><a:clrScheme name="VIT AI">{scheme}</a:clrScheme><a:fontScheme name="Arial"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Default"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>')
    for i,item in enumerate(slides,1):
        z.writestr(f'ppt/slides/slide{i}.xml',slide(i,item))
        z.writestr(f'ppt/slides/_rels/slide{i}.xml.rels',rel([('rId1','slideLayout','../slideLayouts/slideLayout1.xml')]))
print(OUT)
