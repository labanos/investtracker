
<%@ page import="investtrckr.Purchase" %>
<!DOCTYPE html>
<html>
	<head>
		<meta name="layout" content="main">
		<g:set var="entityName" value="${message(code: 'purchase.label', default: 'Purchase')}" />
		<title><g:message code="default.list.label" args="[entityName]" /></title>
	</head>
	<body>
		<a href="#list-purchase" class="skip" tabindex="-1"><g:message code="default.link.skip.label" default="Skip to content&hellip;"/></a>
		<div class="nav" role="navigation">
			<ul>
				<li><a class="home" href="${createLink(uri: '/')}"><g:message code="default.home.label"/></a></li>
				<li><g:link class="create" action="create"><g:message code="default.new.label" args="[entityName]" /></g:link></li>
			</ul>
		</div>
		<div id="list-purchase" class="content scaffold-list" role="main">
			<h1><g:message code="default.list.label" args="[entityName]" /></h1>
			<g:if test="${flash.message}">
			<div class="message" role="status">${flash.message}</div>
			</g:if>
			<table>
				<thead>
					<tr>
					
						<g:sortableColumn property="date" title="${message(code: 'purchase.date.label', default: 'Date')}" />
					
						<g:sortableColumn property="price" title="${message(code: 'purchase.price.label', default: 'Price')}" />
					
						<g:sortableColumn property="quantity" title="${message(code: 'purchase.quantity.label', default: 'Quantity')}" />
					
						<th><g:message code="purchase.investment.label" default="Investment" /></th>
					
					</tr>
				</thead>
				<tbody>
				<g:each in="${purchaseInstanceList}" status="i" var="purchaseInstance">
					<tr class="${(i % 2) == 0 ? 'even' : 'odd'}">
					
						<td><g:link action="show" id="${purchaseInstance.id}">${fieldValue(bean: purchaseInstance, field: "date")}</g:link></td>
					
						<td>${fieldValue(bean: purchaseInstance, field: "price")}</td>
					
						<td>${fieldValue(bean: purchaseInstance, field: "quantity")}</td>
					
						<td>${fieldValue(bean: purchaseInstance, field: "investment")}</td>
					
					</tr>
				</g:each>
				</tbody>
			</table>
			<div class="pagination">
				<g:paginate total="${purchaseInstanceTotal}" />
			</div>
		</div>
	</body>
</html>
