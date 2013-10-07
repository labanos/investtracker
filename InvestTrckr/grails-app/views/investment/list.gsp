
<%@ page import="investtrckr.Investment" %>
<!DOCTYPE html>
<html>
	<head>
		<meta name="layout" content="main">
		<g:set var="entityName" value="${message(code: 'investment.label', default: 'Investment')}" />
		<title><g:message code="default.list.label" args="[entityName]" /></title>
	</head>
	<body>
		<a href="#list-investment" class="skip" tabindex="-1"><g:message code="default.link.skip.label" default="Skip to content&hellip;"/></a>
		<div class="nav" role="navigation">
			<ul>
				<li><a class="home" href="${createLink(uri: '/')}"><g:message code="default.home.label"/></a></li>
				<li><g:link class="create" action="create"><g:message code="default.new.label" args="[entityName]" /></g:link></li>
			</ul>
		</div>
		<div id="list-investment" class="content scaffold-list" role="main">
			<h1><g:message code="default.list.label" args="[entityName]" /></h1>
			<g:if test="${flash.message}">
			<div class="message" role="status">${flash.message}</div>
			</g:if>
			<table>
				<thead>
					<tr>
					
						<g:sortableColumn property="name" title="${message(code: 'investment.name.label', default: 'Name')}" />
					
						<g:sortableColumn property="tracker" title="${message(code: 'investment.tracker.label', default: 'Tracker')}" />
					
					</tr>
				</thead>
				<tbody>
				<g:each in="${investmentInstanceList}" status="i" var="investmentInstance">
					<tr class="${(i % 2) == 0 ? 'even' : 'odd'}">
					
						<td><g:link action="show" id="${investmentInstance.id}">${fieldValue(bean: investmentInstance, field: "name")}</g:link></td>
					
						<td>${fieldValue(bean: investmentInstance, field: "tracker")}</td>
					
					</tr>
				</g:each>
				</tbody>
			</table>
			<div class="pagination">
				<g:paginate total="${investmentInstanceTotal}" />
			</div>
		</div>
	</body>
</html>
