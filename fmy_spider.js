
var https = require('https');
var http = require('http');
var jsdom = require("jsdom"); 
var jqMod = require("jquery");
var fs = require('fs');

var Iconv = require('iconv').Iconv;

String.format = function() { 
    var s = arguments[0]; 
    for (var i = 0; i < arguments.length - 1; i++) { 
        var reg = new RegExp("\\{" + i + "\\}", "gm"); 
        s = s.replace(reg, arguments[i + 1]); 
    }

    return s; 
};

/*res.on(‘data’) 监听data事件。
res.on(‘end’) 数据获取完毕事件。
Buffer.concat(chunks, size); 连接多次data的buff。
data.toString() 将data二进制数据转换成utf-8的字符串，如果页面是GBK的时候，请使用iconv模块进行转换，原生Node.js不支持GBK*/

//rewrite http.get

var _http_get = http.get;
var _reqCount = 0,
	_resCount = 0;

//数据
var areaList = [];

http.sGet = function (){
	// _reqCount++;
	var args = [].slice.call(arguments, 0);

	return http.get.apply(http, args);

}

function _checkStatus(){

	if(_reqCount <= _resCount){
		onResult();
	}
}

function onResult(data){

	console.log('** SUM OF DOCTORS: ' + _resCount + ' **');
	console.log('** FINISHED --------------------------------- **');
	// console.log(JSON.stringify(areaList));

	// console.log(areaList[0]['hosList'][0]['department'][0]['officeList'][0]['doctor']);
	// console.log(areaList[1]['hosList'][0]['department'][0]['officeList'][0]['doctor']);

	var dataStr = JSON.stringify(areaList);

	fs.writeFile("/Users/cloud/Desktop/output_data.txt", dataStr, function(err) {
	    if(err) {
	        console.log(err);
	        //释放内存
			areaList = null;
	    } else {
	        console.log("File Saved!");
	        //释放内存
			areaList = null;
	    }
	});
}

function spider (url, cb){

	http.sGet(url, function(res) {
	    var size = 0;
	    var chunks = [];
		res.on('data', function(chunk){
		    size += chunk.length;
		    chunks.push(chunk);
		});
	  	res.on('end', function(){

	    	var buffer = new Buffer(size), pos = 0;

	        for(var i = 0, l = chunks.length; i < l; i++) {
	            chunks[i].copy(buffer, pos);
	            pos += chunks[i].length;
	        }
			//buffer不支持GBK
	        var gbk_to_utf8_iconv = new Iconv('GBK', 'UTF-8//TRANSLIT//IGNORE');
	        var utf8_buffer = gbk_to_utf8_iconv.convert(buffer);

	        var htmlSource = utf8_buffer.toString();
		console.log(htmlSource)
	        jsdom.env({  
				html: htmlSource,
				scripts: [
					'http://front.staging-fangmingyi.com//static/lib/jquery-2.1.0.min.js'
				],
				done: function (err, window) {
					var $ = window.jQuery;	
					//release memory
					buffer = null;
					htmlSource = null;
					gbk_to_utf8_iconv = null;
					utf8_buffer = null

					//--------------
					cb ? cb($) : '';

				},
				fail: function(e){
					console.log('******E:', e);
					
				}
			});

	  	});

	}).on('error', function(e) {
	 	console.log("Got error: " + e.message);
	});

}


/**
 * 解析北京各区 医院列表页面
 */
function parse_s_0 ($){

	var $td = $('body .bluepanel .jblb tr td'),
		tdLen = $td.length;

	var a=0, b=0;

	var curHos;

	$td.each(function(eq, c){
		var $c = $(c),
			head = $c.html().trim(),
			isLastTd = (tdLen == (eq+1));

		var $a = $c.children('a'),
			aLen = $a.length;
		//如果不为空切不含有a标签
		if(head != '&nbsp;' && head != '' && aLen == 0){
			curHos ? areaList.push(curHos) : '';
			// console.log(head);
			curHos = {
				name: head,
				hosList: []
			}
			
		}else {	
			aLen && curHos.hosList.push({
				name: $a.html().trim(),
				url: $a.attr('href')
			});
			isLastTd ? areaList.push(curHos) : '';
		}
	});

	parse_s_1(areaList);
	// console.log((areaList));
}

/**
 * 解析医院内 科室列表 页面=========
 */
function parse_s_1(infoList){

	var len = infoList.length;

	//循环区列表
	for(var i=0; i<len; i++){
		var curArea = infoList[i],
			curAreaHosList = curArea.hosList,
			hosLen = curAreaHosList.length;

		/**
		 * debug =========
		 */
		if(i > 1)
			break;
		//==============
		console.log('****** 市区: ' + curArea.name);

		//设置数量
		infoList[i].size = hosLen;
		//循环区包含的医院列表
		for(var k=0; k<hosLen; k++){
			//每个医院的url
			var curHos = curAreaHosList[k],
				hosUrl = curHos['url'];
			/**
			 * debug =========
			 */
			if(k > 0)
				break;
			//==============
			//解析具体医院的科室
			console.log('****** *** 医院名称: '+curHos.name);

			parseHospital(hosUrl, curHos);

		}
	}

	// console.log(infoList)

}
//打开医院页面，解析其中的科室
function parseHospital(hosUrl, curHos){

	var typeList = [];

	spider(hosUrl, function($){

		var $tb = $('#hosbra tr td table'),
			tbLen = $tb.length;

		$tb.each(function(eq, c){
			//当前科室类别
			var $c = $(c);

			var typeName = $c.parent('td').prev('td').html();

			var curDepType = {
				name: typeName,
				officeList: []
			};

			var $td = $c.find('tr td');
			$td.each(function(eq, c){
				var $cc = $(c);

				var $a = $cc.children('a'),
					$span = $cc.children('span'),

					aLen = $a.length;

				//当前科
				aLen && curDepType.officeList.push({
					name: $a.html().trim(),
					url: $a.attr('href')
				});

			});
			curDepType.size = curDepType.officeList.length;

			typeList.push(curDepType);

		});

		curHos['department'] = typeList;

		// console.log(JSON.stringify(depList));
		// console.log(areaList[0].hosList[0].department);
		// console.log(depList);
		parse_s_2(typeList);

	});

}
/**
 * 解析具体科室医生列表页面=================
 * @param  {[type]} office [description]
 * @return {[type]}        [description]
 */
function parse_s_2(typeList){
	var dLen = typeList.length;

	for(var p=0; p<dLen; p++){
		var curDepType = typeList[p];

		var offList = curDepType.officeList,
			oLen = offList.length;

		/**
		 * debug
		 * @type {[type]}
		 */
		if(p>0)
			break;
		//================
		console.log('****** *** *** 科室类别: '+curDepType.name);

		for(var k=0; k<oLen; k++){
			var curOff = offList[k];
			/**
			 * debug
			 * @type {[type]}
			 */
			if(k>1)
				break;
			//================
			console.log('****** *** *** *** 详细科室名称: '+curOff.name);

			// console.log(curOff)
			parseOffice(curOff);
		}


	}
}
//接续具体的科室，查看医生
//debug: ****** 分页情况还没有做，当检测到有分页的时候，应该抓取分页的数据！！！！
function parseOffice(office){
	var docList = [];

	spider(office.url, function($){
		var $li = $('#doc_list_index tr .tda li');

		$li.each(function(eq, c){
			var $c = $(c);

			$a = $c.children('a'),
			$p = $c.children('p');
			//具体医生
			var curDoc = {
				name: $a.html().trim(),
				url: $a.attr('href'),
				title: $p.eq(0).html() || '',
				degree: $p.eq(1).html() || ''
			}	

			docList.push(curDoc);
		});
		office['doctor'] = docList;
		// console.log(docList)
		parse_s_3(docList);

	});
}

//解析医生详细信息页面===========
// var curDoctor;
function parse_s_3(docList){
	var dLen = docList.length;

	for(var m=0; m<dLen; m++){
		/**
		 * debug
		 * @type {[type]}
		 */
		if(m>2)
			break;
		//==============

		(function(pos){
			//记录发起的医生解析
			_reqCount++;
			spider(docList[pos].url, function($){

				var curDoctor = docList[pos];

				console.log('****** *** *** *** *** 医生信息: '+curDoctor.name);
				// console.log(curDoctor);
				/*console.log('mark1: '+ pos);
				console.log('mark1-doctor: '+ curDoctor.name);*/

				parseDoctor($, curDoctor);
			});

		})(m);
		
	}
}

function parseDoctor($, curDoctor){
	
	var $tar = $('#bp_footer').parent('div').nextAll('script').eq(1);
	var source = $tar.html();
	// console.log(source);

	var BigPipe = {
		onPageletArrive: function(arg){
			var htmlSource = '<html><body>'+arg.content+'</body></html>';

			jsdom.env({  
				html: htmlSource,
				scripts: [
					'http://front.staging-fangmingyi.com//static/lib/jquery-2.1.0.min.js'
				],
				done: function (err, window) {
					var $ = window.jQuery;	
					doctorDetailAnalyse($, curDoctor);
					//返回结果计数器
					_resCount++;
					console.log(_reqCount, _resCount);

					//检测是否结束了所有请求，不靠谱
					_checkStatus();
				},
				fail: function(e){
					//返回结果计数器
					_resCount++;
					console.log(_reqCount, _resCount);

					console.log('E:', e);
				}
			});
			
		}
	}

	//编译js
	try {
		eval(source);
	}catch(e){
		// console.log(source);
		doctorDetailAnalyse($, curDoctor);
		//返回结果计数器
		_resCount++;
		console.log(_reqCount, _resCount);

		// console.log($('#bp_doctor_about').html());
	}
	
}

function doctorDetailAnalyse($, curDoctor){
	var $tr = $('.doctor_about > .middletr > .lt > table > tr');

	var avatarUrl = '';
	var $avatarImg = $tr.eq(0).find('.ys_tx table td img');

	//如果存在头像图片
	if($avatarImg.length){
		avatarUrl = $avatarImg.attr('src');
		//保持序列统一，hack
		$tr = $tr.slice(1);
	}

	var sOffice = $tr.eq(0).children('td').eq(2).find('a > h2').html() || '',

		sInfo  = $tr.eq(1).children('td').eq(2).html() || '',
		sList = sInfo.split(' '),

		sSpecial = $tr.eq(2).find('#full_DoctorSpecialize').html() || '',
		sStory = $tr.eq(3).find('#full').html() || '';

	var info = {
		name: $('.doctor_about .toptr .lt .nav h1 a').html().trim(),

		avatar: avatarUrl,
		//科室
		office: sOffice.trim().replace('&nbsp;', '') || '',
		//职称
		title:  sList[0] || '',
		//学位
		degree: sList[1] || '',
		//特长
		special: sSpecial.replace(/<span>[\w\W/]*<\/span>/g, '').trim() || '',
		//职业经历
		//清楚干扰因素
		story:  sStory.replace(/<span>[\w\W]*<\/span>/g, '').replace(/<!--HAODF:8:[\w]*-->/g, '').replace(/<!--HAODF:\/8:[\w]*-->/g, '').trim() || ''
		//.replace(/<!--[\w\W^<]*-->/g, '')

	}

	curDoctor['information'] = info;

	console.log(curDoctor);
}
//开始抓取
spider('http://beijing.haodf.com/', parse_s_0);


