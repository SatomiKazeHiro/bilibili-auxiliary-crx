# 目标

完成B站辅助插件开发。

实现历史记录的辅助功能：

- 现有问题：
  1. 官方历史记录的视频没有展示视频的上传/发布时间，尤其是学习视频，发布太早但可能已经过时了，比如skill的作用优先于agent和mcp，则skill应该优先学。但需要点开的时候才知道，特别麻烦。
  2. 有些视频是失效了的（被撤下），但还有封面和标题，点击的时候在新页面看到了“啊叻？视频不见了？视频内容已被UP主删除，视频无法观看，敬请谅解。”才知道，这也很麻烦。
- 辅助功能：
  1. 实现在历史记录里的视频上，增加上传/发布时间的在历史内容上的展示。
  2. 右侧新增面板按上传/发布时间的远近（如“今天”、“本周”、“本月”、“上月”、“本季度”、“本年”、“很久以前”）来过滤表示视频。



## 历史记录页面情况

用户进入 https://www.bilibili.com/history 页面时，会有“今天”、“昨天”、“近一周”……之类的板块，每个板块是动态加载的，看用户下拉的情况，每个板块有自己的 div.timeline-item.history-timeline-item 的内容区域。内容区域里面除了各种信息，其中有一个 div.section-cards.grid-mode 需要注意，这个是内容区域的视频集合的容器，其下有视频的简介 div.history-card.grid-mode，大致内容如下：

```html
<div class="history-card grid-mode">
  <div class="history-card__left">
    <div class="history-card__main">
      <div class="bili-video-card video-card">
        <div class="bili-video-card__wrap">
          <div class="bili-video-card__cover">
            <a class="bili-cover-card bili-cover-card--frozen" href="//www.bilibili.com/video/BV1eU5A6MERk/?spm_id_from=333.1391.0.0" target="_blank">
              <div class="bili-cover-card__thumbnail">
                <img src="//i0.hdslb.com/bfs/archive/8f25501c22f87cc1c6cd4b3abc2877bcf298f80b.jpg@760w_428h_1c.avif" alt="精讲OpenSpec，从操作到原理，吃透这个AI编程提效的神器" onload="typeof window.bmgCmptOnload === 'function' &amp;&amp; window.bmgCmptOnload(this)"
                  onerror="typeof window.bmgCmptOnerror === 'function' &amp;&amp; window.bmgCmptOnerror(this)">
              </div>
              <div class="bili-cover-card__stats">
                <div class="bili-cover-card__stat"><span>00:00/14:26</span></div>
              </div>
              <div class="bili-cover-card__progress" style="--bili-cover-card-progress-value: 1%"></div>
            </a>
          </div>
          <div class="bili-video-card__details">
            <div class="bili-video-card__title bili-video-card__title--pr" title="精讲OpenSpec，从操作到原理，吃透这个AI编程提效的神器">
              <a href="//www.bilibili.com/video/BV1eU5A6MERk/?spm_id_from=333.1391.0.0" target="_blank">精讲OpenSpec，从操作到原理，吃透这个AI编程提效的神器</a>
              <div class="bili-card-aside-action"><i class="sic-BDC-trash_delete_line"></i></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

你需要在它动态加载后，解析出bvid（www.bilibili.com/video/BV1eU5A6MERk里面的BV1eU5A6MERk），还有连接（www.bilibili.com/video/BV1eU5A6MERk）、标题（精讲OpenSpec，从操作到原理，吃透这个AI编程提效的神器）、封面（i0.hdslb.com/bfs/archive/8f25501c22f87cc1c6cd4b3abc2877bcf298f80b.jpg@760w_428h_1c.avif）



## 思路

用户进入历史页面后，根据用户窗口下滚，动态加载内容区域，内容区域动态加载历史视频项，你解析视频项得到：bvid、连接、标题、封面。不过还需要请求https://www.bilibili.com/video/ + bvid（如https://www.bilibili.com/video/BV1eU5A6MERk）接口，得到的是html文本，里面有两个有用的信息，一个是上传和发布时间：

```
<meta data-vue-meta="true" itemprop="uploadDate" content="2026-04-02 17:00:33">
<meta data-vue-meta="true" itemprop="datePublished" content="2026-04-02 17:00:33">
```

> 注意：若是上传/发布为空，则是视频失效，不做处理，跳过这个：
>
> ```
> <meta data-vue-meta="true" itemprop="uploadDate" content="">
> <meta data-vue-meta="true" itemprop="datePublished" content="">
> ```

一个是在json格式内的tags信息，可能需要正则表达式提取出来：

```
"tags":[{"tag_id":46183,"tag_name":"人工智能","music_id":"","tag_type":"old_channel","jump_url":"","showDetail":false,"showReport":false,"timeOut":null},{"tag_id":64714073,"tag_name":"AI Coding","music_id":"","tag_type":"old_channel","jump_url":"","showDetail":false,"showReport":false,"timeOut":null},{"tag_id":80836220,"tag_name":"Qoder","music_id":"","tag_type":"old_channel","jump_url":"","showDetail":false,"showReport":false,"timeOut":null}],
```

将bvid、链接、标题、封面、uploadDate、datePublished、tags记录在indexeddb中，避免重复请求。后续的再次进入历史记录页面的时候，只需根据bvid更新链接、标题、封面。

这样在history-card grid-mode左上角增加一个uploadDate进行展示。

每当页面在滚动时，加载后识别出来的视频项，也在当前页面的右侧做一个列表（仅在当前页面生效），列表面板渲染识别出来的视频，按上传/发布时间的远近（如“今天”、“本周”、“本月”、“上月”、“本季度”、“本年”、“很久以前”）来过滤。



## 其他

开发的时候，可以使用react、dayjs之类的来处理。